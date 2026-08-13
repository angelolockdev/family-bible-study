import test from 'node:test'
import assert from 'node:assert/strict'
import { extractPrivateArticle } from './watchtower-private-pack.mjs'

const study = {
  id: 'watchtower-2026401',
  documentId: 2026401,
  title: 'Lahatsoratra fitsapana',
  sourceUrl: 'https://www.jw.org/mg/article/',
  questions: [{ id: '2026401-q1-2', paragraphNumbers: ['1', '2'] }],
}

const html = `<!doctype html><html><body>
<article id="article">
  <div class="bodyTxt">
    <p class="qu" data-pid="40">1-2. Fanontaniana?</p>
    <p class="p7" data-pid="7">1 Paragrafy voalohany. <a class="jsBibleLink" href="https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/jaona/6/#v43006068">Jaona 6:68</a>.<a class="footnoteLink">a</a></p>
    <figure>
      <span class="jsRespImg"
        data-img-att-alt="Sary fanazavana"
        data-img-size-xs="https://cms-imgp.jw-cdn.org/img/p/test_xs.jpg"
        data-img-size-md="https://cms-imgp.jw-cdn.org/img/p/test_md.jpg"
        data-img-size-lg="https://cms-imgp.jw-cdn.org/img/p/test_lg.jpg"></span>
      <figcaption><p class="p76" data-pid="76">Fanazavana ny sary.</p></figcaption>
    </figure>
    <h2 data-pid="12">INTERTITRE</h2>
    <p class="p8" data-pid="8">2 Paragrafy faharoa.</p>
  </div>
</article>
</body></html>`

test('extracts ordered paragraphs, headings, responsive figures, and public question mappings', async () => {
  const article = await extractPrivateArticle({
    html,
    study,
    dimensionsForUrl: async () => ({ width: 1200, height: 800 }),
    excerptForUrl: async () => 'Tompo ô, hankany amin’iza moa izahay?',
  })

  assert.equal(article.contentKey, study.id)
  assert.equal(article.documentId, study.documentId)
  assert.match(article.sourceDigest, /^[a-f0-9]{64}$/)
  assert.deepEqual(article.blocks.map((block) => block.type), ['paragraph', 'figure', 'heading', 'paragraph'])
  assert.deepEqual(article.blocks[0], {
    id: 'paragraph-7',
    type: 'paragraph',
    number: '1',
    text: 'Paragrafy voalohany. Jaona 6:68.',
    questionIds: ['2026401-q1-2'],
    segments: [
      { type: 'text', text: 'Paragrafy voalohany. ' },
      {
        type: 'scripture',
        label: 'Jaona 6:68',
        url: 'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/jaona/6/#v43006068',
        excerpt: 'Tompo ô, hankany amin’iza moa izahay?',
      },
      { type: 'text', text: '.' },
    ],
  })
  assert.equal(article.blocks[1].afterParagraph, '1')
  assert.equal(article.blocks[1].caption, 'Fanazavana ny sary.')
  assert.equal(article.blocks[1].src, 'https://cms-imgp.jw-cdn.org/img/p/test_lg.jpg')
  assert.deepEqual(article.blocks[1].sources.map((source) => source.width), [320, 800, 1200])
  assert.equal(article.blocks[2].text, 'INTERTITRE')
  assert.deepEqual(article.blocks[3].questionIds, ['2026401-q1-2'])
  assert.equal(article.blocks.some((block) => 'text' in block && block.text.includes('Fanontaniana')), false)
})

test('preserves supplemental unnumbered paragraphs without associating a public question', async () => {
  const supplementalHtml = html.replace('</div>', '<p class="p68" data-pid="68">Torohevitra fanampiny.</p></div>')
  const article = await extractPrivateArticle({
    html: supplementalHtml,
    study,
    dimensionsForUrl: async () => ({ width: 1200, height: 800 }),
  })

  const supplemental = article.blocks.at(-1)
  assert.equal(supplemental.type, 'paragraph')
  assert.equal(supplemental.number, 'fanampiny-68')
  assert.equal(supplemental.text, 'Torohevitra fanampiny.')
  assert.deepEqual(supplemental.questionIds, [])
})

test('extracts the final official summary prompts after the article body', async () => {
  const summaryHtml = html.replace('</article>', `
    <aside>
      <div class="boxTtl"><h2>NAHOANA IRETO FAHAMARINANA TELO IRETO NO MANAMPY ANTSIKA?</h2></div>
      <div class="boxContent"><ul>
        <li><p class="p30">I Jehovah no Mpamorona</p><div class="gen-field">Valin-teninao</div></li>
        <li><p class="p32">Tenin’Andriamanitra ny Baiboly</p><div class="gen-field">Valin-teninao</div></li>
      </ul></div>
    </aside>
  </article>`)
  const article = await extractPrivateArticle({
    html: summaryHtml,
    study,
    dimensionsForUrl: async () => ({ width: 1200, height: 800 }),
  })

  assert.deepEqual(article.blocks.at(-1), {
    id: 'summary-review',
    type: 'summary',
    title: 'NAHOANA IRETO FAHAMARINANA TELO IRETO NO MANAMPY ANTSIKA?',
    prompts: ['I Jehovah no Mpamorona', 'Tenin’Andriamanitra ny Baiboly'],
  })
})

test('rejects non-Malagasy sources and stale public source digests', async () => {
  await assert.rejects(
    extractPrivateArticle({
      html,
      study: { ...study, sourceUrl: 'https://www.jw.org/en/library/magazines/article/' },
      dimensionsForUrl: async () => ({ width: 1200, height: 800 }),
    }),
    /malagasy/i,
  )
  await assert.rejects(
    extractPrivateArticle({
      html,
      study: { ...study, sourceDigest: 'a'.repeat(64) },
      dimensionsForUrl: async () => ({ width: 1200, height: 800 }),
    }),
    /source Watchtower a changé/i,
  )
})
