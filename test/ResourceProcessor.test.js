#!/usr/bin/env node

var vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    basename = path.basename(__filename),
    fs = require('fs'),
    chunks = [],
    asyncProcessed,
    syncProcessed,
    ResourceReader = require('../lib/ResourceReader'),
    ResourceProcessor = require('../lib/ResourceProcessor'),
    Template = require('../lib/Template'),
    def = {argv: {}},
    reader = new ResourceReader();

/**
 * @private
 */
function assertTopicPropertyContext(value, toString) {
    value = toString ? value.toString() : value;
    var context = {
        topic: function (topic) {
            return topic[this.context.name];
        }
    }
    context["is " + value] = function (topic) {
        assert.strictEqual(toString ? topic.toString() : topic, value);
    };
    return context;
}

/**
 * @private
 */
function handleEvent(processor, eventType, stream, asyncChunk) {
    switch (eventType) {
    // When ReadStream is created
    case ResourceReader.event.READ_STREAM_START:
        asyncProcessed = '';
        syncProcessed = processor.apply(stream.mimeType, stream.path, fs.readFileSync(stream.path).toString(), def);
        break;

    // When ReadStream reads
    case ResourceReader.event.READ_STREAM_DATA:
        asyncChunk = processor.apply(stream.mimeType, stream.path, asyncChunk.toString(), def);
        chunks.push({
            asyncProcessed: asyncChunk,
            syncProcessed: syncProcessed.substr(asyncProcessed.length, asyncChunk.length)
        });
        asyncProcessed += asyncChunk;
        break;

    // When ReadStream ends
    case ResourceReader.event.READ_STREAM_END:
        this.callback(processor, asyncProcessed, syncProcessed, chunks);
        break;
    }
}

/**
 * Test suite
 */
vows.describe(basename).addBatch({
    "processor": {
        topic: new ResourceProcessor(),
        "instanceof ResourceProcessor": function (processor) {
            assert.strictEqual(processor instanceof ResourceProcessor, true);
        },
        "property": {
            // proto
            "currentFileIndex":
                assertTopicPropertyContext(0),
            "date":
                assertTopicPropertyContext(new Date(), true)
        },
        "apply": {
            topic: function (processor) {
                reader
                    .on(ResourceReader.event.READ_STREAM_START,
                        handleEvent.bind(this, processor, ResourceReader.event.READ_STREAM_START))
                    .on(ResourceReader.event.READ_STREAM_DATA,
                        handleEvent.bind(this, processor, ResourceReader.event.READ_STREAM_DATA))
                    .on(ResourceReader.event.READ_STREAM_END,
                        handleEvent.bind(this, processor, ResourceReader.event.READ_STREAM_END))
                    .read([path.join(__dirname, 'test-in', 'largefile2.txt')]);
            },
            "syncProcessed is not empty": function (processor, asyncProcessed, syncProcessed) {
                assert.isNotEmpty(syncProcessed);
            },
            "asyncProcessed is not empty": function (processor, asyncProcessed, syncProcessed) {
                assert.isNotEmpty(asyncProcessed);
            },
            "syncProcessed.length is 4397890": function (processor, asyncProcessed, syncProcessed) {
                assert.strictEqual(syncProcessed.length, 4397890);
            },
            "asyncProcessed.length is 4397890": function (processor, asyncProcessed, syncProcessed) {
                assert.strictEqual(asyncProcessed.length, 4397890);
            },
            "asyncProcessed chunks equal syncProcessed chunks": function (processor, asyncProcessed, syncProcessed, chunks) {
                chunks.forEach(function(chunk) {
                    assert.strictEqual(chunk.asyncProcessed, chunk.syncProcessed);
                });
            },
            "getActiveTpl is object": function (processor, asyncProcessed, syncProcessed) {
                var template = processor.getActiveTpl(path.join(__dirname, 'test-in', 'largefile2.txt'));
                assert.isObject(template);
            },
            "getActiveTpl instanceof Template": function (processor, asyncProcessed, syncProcessed) {
                var template = processor.getActiveTpl(path.join(__dirname, 'test-in', 'largefile2.txt'));
                assert.strictEqual(template instanceof Template, true);
            }/*,
            "save asyncProcessed": function (processor, asyncProcessed, syncProcessed) {
                fs.writeFileSync(
                    path.join(__dirname, 'test-out', path.basename(__filename)),
                    asyncProcessed
                );
            }*/
        }
    }
}).export(module);
