import assert from 'node:assert/strict'
import test from 'node:test'
import { MOBILE_PAIR_PATH, pairingUrl, resolveOptions, tokenOf, terminalQr, svgQr, name, inject } from '../lib/index.js'

test('pairing URL carries the launch token as the app expects', () => {
  assert.equal(pairingUrl('http://10.1.1.8:3080', 'abc123'), 'http://10.1.1.8:3080/?token=abc123')
})

test('pairing URL keeps a mounted root and drops a stale token', () => {
  const url = pairingUrl('https://box.example/dsh/?token=old', 'new')
  assert.equal(url, 'https://box.example/dsh/?token=new')
})

test('tokenOf reads the token back and tolerates junk', () => {
  assert.equal(tokenOf('http://127.0.0.1:3080/?token=xyz'), 'xyz')
  assert.equal(tokenOf('http://127.0.0.1:3080/'), undefined)
  assert.equal(tokenOf('http://127.0.0.1:3080/?token='), undefined)
  assert.equal(tokenOf('not a url'), undefined)
})

test('stable identity and required services', () => {
  assert.equal(name, 'mobile-pair')
  assert.deepEqual(inject, ['webServer', 'connection'])
  assert.equal(MOBILE_PAIR_PATH, '/api/mobile-pair')
})

test('terminal QR renders and encodes the pairing URL', async () => {
  const text = await terminalQr('http://10.1.1.8:3080/?token=abc123', true)
  assert.equal(typeof text, 'string')
  assert.ok(text.length > 0)
})

test('SVG QR is a self-contained document of the right size', async () => {
  const svg = await svgQr('http://10.1.1.8:3080/?token=abc123')
  assert.match(svg, /^<svg[\s>]/)
  assert.match(svg.trimEnd(), /<\/svg>$/)
})

test('options default to enabled and honor explicit false', () => {
  const defaults = resolveOptions(undefined)
  assert.deepEqual(defaults, { terminal: true, route: true, small: true })
  assert.deepEqual(resolveOptions({ small: false, terminal: false }), { terminal: false, route: true, small: false })
  // Unknown/garbage values never fail the load.
  assert.deepEqual(resolveOptions({ route: 'yes', nope: 1 }), { terminal: true, route: true, small: true })
})
