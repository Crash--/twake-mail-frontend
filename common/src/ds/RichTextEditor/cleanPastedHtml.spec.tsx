import { cleanPastedHtml } from './cleanPastedHtml'

// The end-to-end spike specs paste whole fixtures (e2e/fixtures/clipboard);
// these are the rules one by one.
describe('cleanPastedHtml', () => {
  it('rebuilds Word lists, nested, without the drawn bullets', () => {
    const word = [
      `<p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span>&nbsp;&nbsp;</span></span></span>One<o:p></o:p></p>`,
      `<p class=MsoListParagraphCxSpMiddle style='mso-list:l0 level2 lfo1'><span><span style='mso-list:Ignore'>o<span>&nbsp;</span></span></span>Nested</p>`,
      `<p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><span><span style='mso-list:Ignore'>·</span></span>Two</p>`,
      `<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><span><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span></span>First</p>`
    ].join('')

    expect(cleanPastedHtml(word)).toBe(
      '<ul><li>One<ul><li>Nested</li></ul></li><li>Two</li></ul><ol><li>First</li></ol>'
    )
  })

  it('unwraps the Google Docs bold wrapper and turns styles into elements', () => {
    const docs =
      '<b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr" style="line-height:1.38"><span style="font-weight:700;color:#000000;font-family:Arial">Bold</span> <span style="font-style:italic;text-decoration:underline">both</span></p></b>'

    expect(cleanPastedHtml(docs)).toBe(
      '<p><strong>Bold</strong> <u><em>both</em></u></p>'
    )
  })

  it('keeps chosen colours and drops the default ones', () => {
    expect(
      cleanPastedHtml(
        '<span style="color: rgb(33, 37, 41); background-color: #fff">plain</span> <span style="color:#c62828;background-color:#ffff00">marked</span>'
      )
    ).toBe(
      'plain <span style="color: rgb(198, 40, 40); background-color: rgb(255, 255, 0)">marked</span>'
    )
  })

  it('turns LibreOffice fonts and alignment into what the editor knows', () => {
    expect(
      cleanPastedHtml(
        '<p align="center"><font color="#c9211e"><font face="Liberation Serif">Red</font></font></p>'
      )
    ).toBe(
      '<p style="text-align: center"><span style="color: rgb(201, 33, 30)">Red</span></p>'
    )
  })

  it('gives links the editor style and headings the weight of bold lines', () => {
    expect(
      cleanPastedHtml(
        '<h2 class="title">Title</h2><a href="https://example.com" style="color: rgb(13, 110, 253); text-decoration: underline">link</a>'
      )
    ).toBe(
      '<p><strong>Title</strong></p><a href="https://example.com">link</a>'
    )
  })
})
