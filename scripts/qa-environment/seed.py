"""Creates the accounts of the QA environment and gives them some mail.

Run by start.sh. Idempotent: an account that already exists is left as it is.

Every account is <uid>@example.com with the uid as password. bob also gets a quota, the
bob-guests team mailbox (shared with alice), the emails of e2e/fixtures/eml in his Inbox, and a
conversation with alice.
"""

import argparse
import base64
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

DOMAIN = "example.com"
USING = [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail",
    "urn:ietf:params:jmap:submission",
]


def http(method, url, body=None, headers=None, auth=None):
    request = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    if auth is not None:
        token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
        request.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def webadmin(base, method, path, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    status, content = http(method, base + path, body, {"Content-Type": "application/json"})
    if status >= 300:
        sys.exit(f"WebAdmin {method} {path}: HTTP {status} {content.decode(errors='replace')}")
    return status


class Jmap:
    def __init__(self, base, uid):
        self.base = base
        self.auth = (f"{uid}@{DOMAIN}", uid)
        status, content = http("GET", f"{base}/jmap/session", auth=self.auth)
        if status != 200:
            sys.exit(f"JMAP session of {uid}: HTTP {status}")
        self.account = json.loads(content)["primaryAccounts"]["urn:ietf:params:jmap:mail"]

    def call(self, method_calls):
        body = json.dumps({"using": USING, "methodCalls": method_calls}).encode()
        status, content = http(
            "POST", f"{self.base}/jmap", body, {"Content-Type": "application/json"}, self.auth
        )
        if status != 200:
            sys.exit(f"JMAP {method_calls[0][0]}: HTTP {status} {content.decode(errors='replace')}")
        responses = json.loads(content)["methodResponses"]
        for name, arguments, _ in responses:
            if name == "error" or arguments.get("notCreated"):
                sys.exit(f"JMAP {method_calls[0][0]} failed: {json.dumps(responses)}")
        return responses

    def mailboxes(self):
        response = self.call([["Mailbox/get", {"accountId": self.account, "ids": None}, "c0"]])
        return {mailbox.get("role") or mailbox["name"]: mailbox["id"] for mailbox in response[0][1]["list"]}

    def import_eml(self, path, mailbox_id, keywords):
        status, content = http(
            "POST",
            f"{self.base}/upload/{self.account}",
            path.read_bytes(),
            {"Content-Type": "message/rfc822"},
            self.auth,
        )
        if status not in (200, 201):
            sys.exit(f"Upload of {path.name}: HTTP {status}")
        blob_id = json.loads(content)["blobId"]
        self.call([[
            "Email/import",
            {
                "accountId": self.account,
                "emails": {"e": {"blobId": blob_id, "mailboxIds": {mailbox_id: True}, "keywords": keywords}},
            },
            "c0",
        ]])

    def send(self, to, subject, text, in_reply_to=None):
        mailboxes = self.mailboxes()
        identity = self.call([["Identity/get", {"accountId": self.account}, "c0"]])[0][1]["list"][0]
        email = {
            "mailboxIds": {mailboxes["drafts"]: True},
            "keywords": {"$draft": True, "$seen": True},
            "from": [{"email": self.auth[0]}],
            "to": [{"email": address} for address in to],
            "subject": subject,
            "bodyValues": {"text": {"value": text}},
            "textBody": [{"partId": "text", "type": "text/plain"}],
        }
        if in_reply_to is not None:
            email["header:In-Reply-To:asMessageIds"] = [in_reply_to]
            email["header:References:asMessageIds"] = [in_reply_to]
        self.call([
            ["Email/set", {"accountId": self.account, "create": {"draft": email}}, "c0"],
            [
                "EmailSubmission/set",
                {
                    "accountId": self.account,
                    "create": {"submission": {"emailId": "#draft", "identityId": identity["id"]}},
                    "onSuccessUpdateEmail": {
                        "#submission": {
                            f"mailboxIds/{mailboxes['drafts']}": None,
                            f"mailboxIds/{mailboxes['sent']}": True,
                            "keywords/$draft": None,
                        }
                    },
                },
                "c1",
            ],
        ])

    def wait_for(self, subject, tries=60):
        for _ in range(tries):
            response = self.call([[
                "Email/query",
                {"accountId": self.account, "filter": {"subject": subject}},
                "c0",
            ], [
                "Email/get",
                {
                    "accountId": self.account,
                    "#ids": {"resultOf": "c0", "name": "Email/query", "path": "/ids"},
                    "properties": ["messageId", "mailboxIds"],
                },
                "c1",
            ]])
            inbox = self.mailboxes()["inbox"]
            for email in response[1][1]["list"]:
                if inbox in email["mailboxIds"]:
                    return email["messageId"][0]
            time.sleep(1)
        sys.exit(f"'{subject}' never reached the Inbox of {self.auth[0]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--webadmin", required=True)
    parser.add_argument("--jmap", required=True)
    parser.add_argument("--eml-dir", required=True, type=pathlib.Path)
    parser.add_argument("uids", nargs="+")
    args = parser.parse_args()

    if http("GET", f"{args.webadmin}/users/bob@{DOMAIN}")[0] == 200:
        print("    already provisioned")
        fresh = []
    else:
        fresh = args.uids
    for uid in args.uids:
        if http("GET", f"{args.webadmin}/users/{uid}@{DOMAIN}")[0] != 200:
            webadmin(args.webadmin, "PUT", f"/users/{uid}@{DOMAIN}", {"password": uid})
        print(f"    {uid}@{DOMAIN} / {uid}")
    if "bob" not in fresh:
        return

    webadmin(args.webadmin, "PUT", f"/quota/users/bob@{DOMAIN}", {"count": 200, "size": 50_000_000})
    webadmin(args.webadmin, "PUT", f"/domains/{DOMAIN}/team-mailboxes/bob-guests")
    for member in ("bob", "alice"):
        webadmin(args.webadmin, "PUT", f"/domains/{DOMAIN}/team-mailboxes/bob-guests/members/{member}@{DOMAIN}?role=member")

    bob = Jmap(args.jmap, "bob")
    inbox = bob.mailboxes()["inbox"]
    emls = sorted(args.eml_dir.rglob("*.eml"))
    for index, eml in enumerate(emls):
        bob.import_eml(eml, inbox, {"$seen": True} if index % 3 == 0 else {})
    print(f"    bob: {len(emls)} emails imported from {args.eml_dir.name}/")

    alice = Jmap(args.jmap, "alice")
    alice.send([f"bob@{DOMAIN}"], "Team lunch on Friday", "Hi Bob,\n\nAre you in for lunch on Friday?\n\nAlice")
    message_id = bob.wait_for("Team lunch on Friday")
    bob.send([f"alice@{DOMAIN}"], "Re: Team lunch on Friday", "Count me in.\n\nBob", in_reply_to=message_id)
    alice.send([f"bob@{DOMAIN}", f"charlotte@{DOMAIN}"], "Quarterly report draft", "Hello both,\n\nThe draft is ready for review.\n\nAlice")
    print("    alice <-> bob: a conversation and an email to bob and charlotte")


if __name__ == "__main__":
    main()
