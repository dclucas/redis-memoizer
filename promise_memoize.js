var redis = require('ioredis'),
	Promise = require('bluebird'),
	crypto = require('crypto');

module.exports = function() {
	var client = redis.createClient.apply(null, arguments);

	function hash(string) {
		return crypto.createHmac('sha1', 'memo').update(string).digest('hex');
	}

	function getKeyFromRedis(ns, key, done) {
		return client.get('memos:' + ns + ':' + key)
		.then(function(value) {
			return JSON.parse(value);
		});
	}

	function writeKeyToRedis(ns, key, value, ttl, done) {
		if(ttl !== 0) {
			client.setex('memos:' + ns + ':' + key, ttl, JSON.stringify(value));//, done);
		} else {
			process.nextTick(done || function() {});
		}
	}

	function memoize(fn, ttl) {
		var functionKey = hash(fn.toString()),
			inFlight = {},
			ttlfn;

		if(typeof ttl == 'function') {
			ttlfn = ttl;
		} else {
			ttlfn = function() { return ttl || 120; }
		}

		function memoizedFunction() {
			var self = this,	// if 'this' is used in the function
				args = Array.prototype.slice.call(arguments),
				done = args.pop(),
				argsStringified = args.map(function(arg) { return JSON.stringify(arg); }).join(",");

			argsStringified = hash(argsStringified);

			getKeyFromRedis(functionKey, argsStringified, function(err, value) {
				if(value) {
					done.apply(self, value);
				} else if(inFlight[argsStringified]) {
					inFlight[argsStringified].push(done);
				} else {
					inFlight[argsStringified] = [done];

					fn.apply(self, args.concat(function() {
						var resultArgs = Array.prototype.slice.call(arguments);

						writeKeyToRedis(functionKey, argsStringified, resultArgs, ttlfn.apply(null, resultArgs));

						if(inFlight[argsStringified]) {
							inFlight[argsStringified].forEach(function(cb) {
								cb.apply(self, resultArgs);
							});
							delete inFlight[argsStringified];
						}
					}));
				}
			});
		}
	}
	
	return function memoize2(fn, ttl) {
		var functionKey = hash(fn.toString()),
			inFlight = {},
			ttlfn;

		if(typeof ttl == 'function') {
			ttlfn = ttl;
		} else {
			ttlfn = function() { return ttl || 120; }
		}
	    
		return function() {
			var self = this,	// if 'this' is used in the function
				args = Array.prototype.slice.call(arguments),
				argsStringified = args.map(function(arg) { return JSON.stringify(arg); }).join(",");

			argsStringified = hash(argsStringified);
			return getKeyFromRedis(functionKey, argsStringified)
				.then(function(value) {
					var res = fn.apply(self, args);
					return res;
				});
		    
			/*
					fn.apply(self, args.concat(function() {
						var resultArgs = Array.prototype.slice.call(arguments);

						writeKeyToRedis(functionKey, argsStringified, resultArgs, ttlfn.apply(null, resultArgs));

						if(inFlight[argsStringified]) {
							inFlight[argsStringified].forEach(function(cb) {
								cb.apply(self, resultArgs);
							});
							delete inFlight[argsStringified];
						}
					}));

			*/
		};
	};
};