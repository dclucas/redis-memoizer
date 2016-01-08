'use strict'

var memoize = require('../')(),
	crypto = require('crypto'),
	redis = require('ioredis').createClient(),
	should = require('should');

describe('redis-memoizer', function() {
	function hash(string) {
		return crypto.createHmac('sha1', 'memo').update(string).digest('hex');
	}

	beforeEach(function() {
		return redis.keys('memos:*').each(function(k) {
			return redis.del(k);
		});
  	})

	it('should create a promisified function', function() {
		var 
			passed = false,
			f = function(x) {
				passed = true;
				return x;
			},
			m = memoize(f);
		
		return m(17).then(function(val) {
			val.should.equal(17);
			passed.should.be.true();
			return true;
		});
	});
	
	it('should memoize a value correctly', function() {
		var 
			passCount = 0,
			f = function(x) {
				passCount++;
				return x;
			},
			m = memoize(f);
		
		// first go -- no chache hit
		return m(13).then(function(val) {
			val.should.equal(13);
			passCount.should.equal(1);
			return m(13);
		// this should have been memoized -- so pass count must not increase
		}).then(function(val) {
			val.should.equal(13);
			passCount.should.equal(1);
			return m(97);
		// new value was provided, so pass count should increase
		}).then(function(val) {
			val.should.equal(97);
			passCount.should.equal(2);
			return m(97);
		// testing cache hit for the new value
		}).then(function(val) {
			val.should.equal(97);
			passCount.should.equal(2);
			return true;
		});
	});
	
	it("should memoize separate function separately", function() {
		var f1 = function(arg) { return 1; },
			f2 = function(arg) { return 2 };

		var m1 = memoize(f1),
			m2 = memoize(f2);

		return m1("x").then(function(val) {
			val.should.equal(1);
			return m2("x");
		}).then(function(val) {
			val.should.equal(2);
			return m1("x");
		}).then(function(val) {
			val.should.equal(1);
			return true;
		});
	});

	it("should prevent a cache stampede", function() {
		var 
			passCount = 0,
			f = function(x) { passCount++; return x; },
			m = memoize(f, 100);

		var start = new Date;

		var p1 = m(1).then(function(val) {
			val.should.equal(1);
			passCount.should.equal(1);
			return true;
		});
		
		var p2 = m(1).then(function(val) {
			val.should.equal(1);
			passCount.should.equal(1);
			return m(1);
		})
		.then(function(val) {
			val.should.equal(1);
			passCount.should.equal(1);
			return true;
		});
		
		return p1.then(p2);
	});

/*
	it('should respect \'this\'', function(done) {
		function Obj() { this.x = 1; }
		Obj.prototype.y = memoize(function(done) {
			var self = this;

			setTimeout(function() {
				done(self.x);
			}, 300);
		});

		var obj = new Obj;

		obj.y(function(x) {
			x.should.equal(1);
			clearCache(obj.y, [], done);
		});
	});

	it('should respect the ttl', function(done) {
		var fn = function(done) { setTimeout(done, 200); },
			memoized = memoize(fn, 1);

		var start = new Date;
		memoized(function() {
			(new Date - start >= 200).should.be.true;

			// Call immediately again. Should be a cache hit
			start = new Date;
			memoized(function() {
				(new Date - start <= 100).should.be.true;

				// Wait some time, ttl should have expired
				setTimeout(function() {
					start = new Date;
					memoized(function() {
						(new Date - start >= 200).should.be.true;
						clearCache(fn, [], done);
					});
				}, 2000);
			});
		});
	});

	it('should allow ttl to be a function', function(done) {
		var fn = function(done) { setTimeout(done, 200); },
			memoized = memoize(fn, function() { return 1; });

		var start = new Date;
		memoized(function() {
			(new Date - start >= 200).should.be.true;

			// Call immediately again. Should be a cache hit
			start = new Date;
			memoized(function() {
				(new Date - start <= 100).should.be.true;

				// Wait some time, ttl should have expired
				setTimeout(function() {
					start = new Date;
					memoized(function() {
						(new Date - start >= 200).should.be.true;
						clearCache(fn, [], done);
					});
				}, 2000);
			});
		});
	});

	it('should work if complex types are accepted as args and returned', function(done) {
		var fn = function(arg1, done) {
			setTimeout(function() {
				done(arg1, ["other", "data"]);
			}, 500);
		};

		var memoized = memoize(fn);

		var start = new Date;
		memoized({some: "data"}, function(val1, val2) {
			(new Date - start >= 500).should.be.true;
			val1.should.eql({some: "data"});
			val2.should.eql(["other", "data"]);

			start = new Date;
			memoized({some: "data"}, function(val1, val2) {
				(new Date - start <= 100).should.be.true;
				val1.should.eql({some: "data"});
				val2.should.eql(["other", "data"]);

				clearCache(fn, [{some: "data"}], done);
			});
		});
	});
	*/
});