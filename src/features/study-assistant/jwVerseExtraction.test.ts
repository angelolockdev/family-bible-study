import { describe, expect, it } from 'vitest'
import { extractVerseExcerptFromHtml, verseIdsFromUrl } from '../../../scripts/extract-jw-verses.mjs'

const chapterHtml = `
<span class="verse" id="v24017007"><span class="style-l"> <sup class="verseNum">7</sup> Hotahina izay olona<a class="footnoteLink">*</a> matoky an’i Jehovah</span><span class="newblock"></span><span class="style-z">Sy miantehitra amin’i Jehovah.<a class="xrefLink">+</a></span><span class="parabreak"></span></span>
<span class="verse" id="v24017008"><span class="style-l"> <sup class="verseNum">8</sup> Ho toy ny hazo nambolena eo amoron-drano izy,</span><span class="newblock"></span><span class="style-z">Dia hazo mampisandrahaka ny fakany hatrany amin’ny renirano.</span><span class="parabreak"></span></span>
`

describe('JW verse extraction', () => {
  it('reads every anchored verse id from a JW Bible URL', () => {
    expect(verseIdsFromUrl('https://www.jw.org/mg/bible/#v24017007-v24017008')).toEqual(['v24017007', 'v24017008'])
  })

  it('returns visible Bible text without note markers or HTML', () => {
    expect(extractVerseExcerptFromHtml(chapterHtml, ['v24017007', 'v24017008'])).toBe(
      '7 Hotahina izay olona matoky an’i Jehovah Sy miantehitra amin’i Jehovah. 8 Ho toy ny hazo nambolena eo amoron-drano izy, Dia hazo mampisandrahaka ny fakany hatrany amin’ny renirano.',
    )
  })

  it('fails rather than inventing text when an anchored verse is absent', () => {
    expect(() => extractVerseExcerptFromHtml(chapterHtml, ['v24017009'])).toThrow('Verse introuvable')
  })
})
