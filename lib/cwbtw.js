(function(){
  var cwbspec, fetch, fetch_rain, parse_rain, fetch_forecast_by_town, get_frames, parse_area, parse_forecast_72hr, fetch_typhoon, parse_typhoon, slice$ = [].slice, replace$ = ''.replace;
  cwbspec = require('./cwb-spec');
  fetch = curry$(function(args, cb){
    return require('request')(args, function(error, arg$, body){
      var statusCode;
      statusCode = arg$.statusCode;
      if (error) {
        throw error;
      }
      if (!deepEq$(statusCode, 200, '===')) {
        throw 'got response ' + statusCode;
      }
      return cb(body);
    });
  });
  fetch_rain = fetch({
    url: 'http://www.cwb.gov.tw/V7/observe/rainfall/A136.htm'
  });
  parse_rain = curry$(function(data, cb){
    var res, $, ref$, time;
    res = [];
    $ = require('cheerio').load(data);
    ref$ = $('table.description td').last().html().split(/ : /), time = ref$[ref$.length - 1];
    $('table#tableData tbody tr').each(function(){
      var ref$, _area, station, rain, station_name, station_id, town, area;
      try {
        ref$ = this.find('td').map(function(){
          return this.text();
        }), _area = ref$[0], station = ref$[1], rain = ref$[2];
      } catch (e$) {}
      ref$ = station.match(/(\S+)\s*\((\S+)\)/), station_name = ref$[1], station_id = ref$[2];
      ref$ = _area.match(/(...)(.*)/), town = ref$[1], area = ref$[2];
      return res.push([station_id, rain, town, area, station_name]);
    });
    return cb(time, res);
  });
  fetch_forecast_by_town = curry$(function(id, cb){
    console.log("http://www.cwb.gov.tw/township/XML/" + id + "_72hr_EN.xml?_=" + new Date().getTime());
    return fetch({
      url: "http://www.cwb.gov.tw/township/XML/" + id + "_72hr_EN.xml?_=" + new Date().getTime(),
      headers: {
        'Referer:': 'Referer:',
        'http://www.cwb.gov.tw/township/enhtml/index.htm': 'http://www.cwb.gov.tw/township/enhtml/index.htm'
      }
    }, cb);
  });
  get_frames = function(Value, layout, timeslice){
    var i, frame, fl;
    i = 0;
    return (function(){
      var i$, ref$, len$, results$ = [];
      for (i$ = 0, len$ = (ref$ = Value).length; i$ < len$; ++i$) {
        frame = ref$[i$], fl = frame['@'].layout;
        if (fl === layout) {
          results$.push(import$({
            ts: timeslice[layout][i++]
          }, frame));
        }
      }
      return results$;
    }()).map(function(it){
      delete it['@'];
      if (it.WindDir != null) {
        it.WindDir = it.WindDir['@'].abbre;
      }
      return it;
    });
  };
  parse_area = function(Value, timeslice){
    var ref$, curr, frames12, i$, len$, frame, results$ = [];
    ref$ = get_frames(Value, '12', timeslice), curr = ref$[0], frames12 = slice$.call(ref$, 1);
    for (i$ = 0, len$ = (ref$ = get_frames(Value, '3', timeslice)).length; i$ < len$; ++i$) {
      frame = ref$[i$];
      if (frame.ts.getTime() === frames12[0].ts.getTime()) {
        curr = frames12.shift();
      }
      if (!frames12.length) {
        break;
      }
      results$.push(import$(import$({}, curr), frame));
    }
    return results$;
  };
  parse_forecast_72hr = curry$(function(data, cb){
    var parser, tmpslice;
    parser = new (require('xml2js')).Parser;
    tmpslice = {};
    return parser.parseString(data, function(err, arg$){
      var result, ref$, ref1$, slice12, slice3, timeslice, areaid, Value;
      result = arg$.ForecastData;
      ref$ = result.Metadata.Time, ref1$ = ref$[0], slice12 = ref1$['@'], tmpslice['12'] = ref1$.FcstTime, ref1$ = ref$[1], slice3 = ref1$['@'], tmpslice['3'] = ref1$.FcstTime;
      timeslice = (function(expand_time){
        var key, ref$, ts, results$ = {};
        expand_time = function(it){
          return new Date(typeof it === 'object' ? it['#'] : it);
        };
        for (key in ref$ = tmpslice) {
          ts = ref$[key];
          results$[key] = ts.map(expand_time);
        }
        return results$;
      }.call(this, void 8));
      return cb(new Date(result.IssueTime), (function(){
        var i$, ref$, len$, ref1$, results$ = {};
        for (i$ = 0, len$ = (ref$ = result.County.Area).length; i$ < len$; ++i$) {
          ref1$ = ref$[i$], areaid = ref1$['@'].AreaID, Value = ref1$.Value;
          results$[areaid] = parse_area(Value, timeslice);
        }
        return results$;
      }()));
    });
  });
  fetch_typhoon = curry$(function(cb){
    return fetch({
      url: 'http://www.cwb.gov.tw/V7/prevent/typhoon/Data/PTA_NEW/pta_index_eng.htm',
      headers: {
        Referer: 'http://www.cwb.gov.tw/V7/prevent/typhoon/Data/PTA_NEW/index_eng.htm'
      }
    }, cb);
  });
  parse_typhoon = curry$(function(data, cb){
    var $, res, i$, ref$, len$, x, $$, name, ref1$, current, forecast, date, lat, lon, swind, windr, re, lines, f, j$, len1$, line, matched;
    $ = require('cheerio').load(data);
    res = [];
    for (i$ = 0, len$ = (ref$ = $('div[id^="effect-"]').get().map($)).length; i$ < len$; ++i$) {
      x = ref$[i$];
      if (x.attr('id').match(/effect-\d-b/)) {
        $$ = $.load(x.html());
        name = replace$.call($$('.DataTabletitle').text(), /^\s*/g, '').replace(/\s*$/gm, '').replace(/Typhoon /, '');
        ref1$ = $$('.DataTableContent').get().map(fn$), current = ref1$[0], forecast = ref1$[1];
        date = current.split("\r\n").shift();
        ref1$ = current.match(/Center Location\s+([\d\.]+)N\s+([\d\.]+)E/), lat = ref1$[1], lon = ref1$[2];
        ref1$ = /Maximum Wind Speed (\d+) m\/s/.exec(current), swind = ref1$[1];
        lat = parseFloat(lat);
        lon = parseFloat(lon);
        swind *= 2;
        windr = [];
        re = /Radius of (\d+)m\/s\s*(\d+)km/;
        while (current.match(re)) {
          current = current.replace(re, fn1$);
        }
        lines = forecast.split("\r\n");
        f = [];
        for (j$ = 0, len1$ = lines.length; j$ < len1$; ++j$) {
          line = lines[j$];
          if (matched = /(\d+) hours valid/.exec(line)) {
            f.push({
              time: parseFloat(matched[1])
            });
          }
          if (matched = /Center Position\s+([\d\.]+)N\s+([\d\.]+)E/.exec(line)) {
            ref1$ = f[f.length - 1];
            ref1$.lat = parseFloat(matched[1]);
            ref1$.lon = parseFloat(matched[2]);
          }
        }
        f.unshift({
          lat: lat,
          lon: lon,
          time: 'T0',
          swind: swind,
          windr: windr
        });
        res.push({
          lat: lat,
          lon: lon,
          date: date,
          name: name,
          forecasts: f
        });
      }
    }
    return cb(res);
    function fn$(it){
      return $(it).text();
    }
    function fn1$(arg$, wr, r){
      wr *= 2;
      r /= 1.852;
      windr.unshift({
        wr: wr,
        ne: r,
        sw: r,
        nw: r,
        se: r
      });
      return '';
    }
  });
  module.exports = {
    cwbspec: cwbspec,
    fetch_rain: fetch_rain,
    parse_rain: parse_rain,
    fetch_forecast_by_town: fetch_forecast_by_town,
    parse_forecast_72hr: parse_forecast_72hr,
    fetch_typhoon: fetch_typhoon,
    parse_typhoon: parse_typhoon
  };
  function deepEq$(x, y, type){
    var toString = {}.toString, hasOwnProperty = {}.hasOwnProperty,
        has = function (obj, key) { return hasOwnProperty.call(obj, key); };
    first = true;
    return eq(x, y, []);
    function eq(a, b, stack) {
      var className, length, size, result, alength, blength, r, key, ref, sizeB;
      if (a == null || b == null) { return a === b; }
      if (a.__placeholder__ || b.__placeholder__) { return true; }
      if (a === b) { return a !== 0 || 1 / a == 1 / b; }
      className = toString.call(a);
      if (toString.call(b) != className) { return false; }
      switch (className) {
        case '[object String]': return a == String(b);
        case '[object Number]':
          return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
        case '[object Date]':
        case '[object Boolean]':
          return +a == +b;
        case '[object RegExp]':
          return a.source == b.source &&
                 a.global == b.global &&
                 a.multiline == b.multiline &&
                 a.ignoreCase == b.ignoreCase;
      }
      if (typeof a != 'object' || typeof b != 'object') { return false; }
      length = stack.length;
      while (length--) { if (stack[length] == a) { return true; } }
      stack.push(a);
      size = 0;
      result = true;
      if (className == '[object Array]') {
        alength = a.length;
        blength = b.length;
        if (first) { 
          switch (type) {
          case '===': result = alength === blength; break;
          case '<==': result = alength <= blength; break;
          case '<<=': result = alength < blength; break;
          }
          size = alength;
          first = false;
        } else {
          result = alength === blength;
          size = alength;
        }
        if (result) {
          while (size--) {
            if (!(result = size in a == size in b && eq(a[size], b[size], stack))){ break; }
          }
        }
      } else {
        if ('constructor' in a != 'constructor' in b || a.constructor != b.constructor) {
          return false;
        }
        for (key in a) {
          if (has(a, key)) {
            size++;
            if (!(result = has(b, key) && eq(a[key], b[key], stack))) { break; }
          }
        }
        if (result) {
          sizeB = 0;
          for (key in b) {
            if (has(b, key)) { ++sizeB; }
          }
          if (first) {
            if (type === '<<=') {
              result = size < sizeB;
            } else if (type === '<==') {
              result = size <= sizeB
            } else {
              result = size === sizeB;
            }
          } else {
            first = false;
            result = size === sizeB;
          }
        }
      }
      stack.pop();
      return result;
    }
  }
  function curry$(f, args){
    return f.length > 1 ? function(){
      var params = args ? args.concat() : [];
      return params.push.apply(params, arguments) < f.length && arguments.length ?
        curry$.call(this, f, params) : f.apply(this, params);
    } : f;
  }
  function import$(obj, src){
    var own = {}.hasOwnProperty;
    for (var key in src) if (own.call(src, key)) obj[key] = src[key];
    return obj;
  }
}).call(this);
