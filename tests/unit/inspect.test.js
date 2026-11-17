import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectHtml } from '../../lib/inspect.js';
test('detects page signals without claiming a complete usability audit', () => {
 const audit=inspectHtml('<title>Test shop</title><meta content="A local shop" name="description"><meta name="viewport" content="width=device-width"><h1>Welcome</h1><a href="tel:123">Call</a><a href="https://instagram.com/example">Instagram</a>');
 assert.equal(audit.title,'Test shop');assert.equal(audit.description,true);assert.equal(audit.viewport,true);assert.equal(audit.h1,true);assert.equal(audit.phone,true);assert.equal(audit.email,false);assert.equal(audit.social,true);assert.equal(audit.whatsapp,false);
});
test('marks absent or empty metadata and heading signals', () => {
 const audit=inspectHtml('<title>  </title><meta name="description" content=" "><p>Hello</p>');
 assert.equal(audit.title,null);assert.equal(audit.description,false);assert.equal(audit.h1,false);assert.equal(audit.phone,false);
});
