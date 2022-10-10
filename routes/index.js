const express = require('express');
const router = express.Router();
const { sse, sseHub, RedisHub } = require('@toverux/expresse');
const { EventEmitter } = require('node:events');

const title = 'Server side events';

const links = [
  { title: 'Basic stream', link: 'index' },
  { title: 'Timer based events', link: 'timers' },
  { title: 'Broadcast - one to many', link: 'broadcast' },
  { title: 'Using redis', link: 'redis' },
  { title: 'Mongo watch', link: 'mongo' }
]

links.forEach(l => {
  router.get('/' + l.link, function(req, res, next) {
    res.render(l.link, { 
      title: title, 
      description: l.title,
      links: links,
      current: l.link
    });
  });
});

/**
 * Without any library
 */
function ServerEvent() {
  this.data = "";
};

ServerEvent.prototype.addData = function(data) {
 var lines = data; //.split(/\n/);

 for (var i = 0; i < lines.length; i++) {
     var element = lines[i];
     this.data += "data:" + element + "\n";
 }
}

ServerEvent.prototype.payload = function() {
  var payload = "";

  payload += this.data;
  return payload + "\n";
}

router.get('/basic-stream', (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
  });
  res.flushHeaders();

  let counter = 0;
  const interval = setInterval(() => {
    // ... 
    const message = counter++;
    var messageEvent = new ServerEvent();
    messageEvent.addData(message); 

    // ...
    res.write(messageEvent.payload());
  }, 2000);
  
  res.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});


/**
 * Send events on a timer 
 */
class SomeModule extends EventEmitter {}
const someModule = new SomeModule();
setInterval(() => {
  someModule.emit('someEvent', { progress: 123 });
}, 2000);

router.get('/timer-stream', sse(), (req, res) => {
  let messageId = parseInt(req.header('Last-Event-ID'), 10) || 0;

  /**
   * React to an event on server side
   */
  someModule.on('someEvent', (event) => {
    //=> Data messages (no event name, but defaults to 'message' in the browser).
    res.sse.data(event);
    //=> Named event + data (data is mandatory)
    res.sse.event('timer', event, (messageId++).toString());
    //=> Comment, not interpreted by EventSource on the browser - useful for debugging/self-documenting purposes.
    res.sse.comment('debug: someModule emitted someEvent!');
    //=> In data() and event() you can also pass an ID - useful for replay with Last-Event-ID header.
    // res.sse.data(event, (messageId++).toString());
  });

});

/**
 * As soon a new user joins in we can send a broadcast to all 
 * others
 */
router.get('/broadcast-stream', sseHub(), (req, res) => {
  
  res.sse.broadcast.event('new-user', `User ${req.query.name} just hit the /channel endpoint`);
});

/**
 * To scale it beyond a single server we could use a redis server
 */
const hub = new RedisHub('redis-channel');
router.get('/redis-stream', sseHub({ hub }), (req, res) => {
  res.sse.broadcast.event('via-redis', `User ${req.query.name} just hit the /channel endpoint`);
});



module.exports = router;