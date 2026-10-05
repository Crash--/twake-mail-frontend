import { driveCardHtml, driveCardsBlock, hasDriveCards } from './driveCard'

describe('Drive card', () => {
  it('writes the card of tmail-flutter, its text escaped', () => {
    const html = driveCardHtml(
      {
        name: '<Plan> & "budget".pdf',
        sharingLink: 'https://drive.example.com/public?a=1&b=2',
        thumbnail: null
      },
      'Open in drive'
    )
    const card = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('a')

    expect(card?.className).toBe('tmail-file-link-card')
    expect(card?.getAttribute('href')).toBe(
      'https://drive.example.com/public?a=1&b=2'
    )
    expect(card?.getAttribute('target')).toBe('_blank')
    expect(card?.textContent).toBe('<Plan> & "budget".pdfOpen in drive ↗')
    expect(card?.querySelector('img')).toBe(null)
  })

  it('finds the cards of a message', () => {
    const block = driveCardsBlock(
      [
        {
          name: 'a.txt',
          sharingLink: 'https://d.example.com/a',
          thumbnail: null
        }
      ],
      'Open in drive'
    )
    expect(hasDriveCards(block)).toBe(true)
    expect(hasDriveCards('<p>No card</p>')).toBe(false)
  })
})
