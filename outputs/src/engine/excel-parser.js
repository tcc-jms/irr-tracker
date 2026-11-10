/**
 * src/engine/excel-parser.js
 * Excel 檔案解析（ZIP + XML）
 * 支援 .xlsx 格式的工作簿讀取
 */

(function(root) {
  'use strict';

  // 反轉義 HTML 實體
  function unesc(s) {
    return s.replace(/&(lt|gt|amp|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, function(m, e) {
      if (e === 'lt') return '<';
      if (e === 'gt') return '>';
      if (e === 'amp') return '&';
      if (e === 'quot') return '"';
      if (e === 'apos') return "'";
      if (e[1] === 'x') return String.fromCodePoint(parseInt(e.slice(2), 16));
      return String.fromCodePoint(parseInt(e.slice(1), 10));
    });
  }

  function attr(s, name) {
    var m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(s);
    return m ? unesc(m[1]) : null;
  }

  // 欄位字母轉數字
  function colToNum(c) {
    var n = 0;
    for (var i = 0; i < c.length; i++) {
      n = n * 26 + (c.charCodeAt(i) - 64);
    }
    return n;
  }

  // 欄位數字轉字母
  function numToCol(n) {
    var s = '';
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = (n - m - 1) / 26;
    }
    return s;
  }

  // 分解儲存格位址（如 'A1' 或 '$A$1'）
  function splitAddr(a) {
    var m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(a);
    return m ? { c: colToNum(m[1]), r: +m[2] } : null;
  }

  // 構建儲存格位址
  function addr(r, c) {
    return numToCol(c) + r;
  }

  // 讀取 ZIP 檔案中的指定檔案
  async function readZip(u8, inflateRaw, wanted) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;

    // 尋找 ZIP 檔案結束記錄
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }

    if (eocd < 0) throw new Error('檔案不是有效的 .xlsx');

    var n = dv.getUint16(eocd + 10, true);
    var p = dv.getUint32(eocd + 16, true);
    var out = {};
    var dec = new TextDecoder('utf-8');

    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;

      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true);
      var xlen = dv.getUint16(p + 30, true);
      var clen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;

      if (wanted && !wanted(name)) continue;

      var lnl = dv.getUint16(lho + 26, true);
      var lxl = dv.getUint16(lho + 28, true);
      var start = lho + 30 + lnl + lxl;
      var data = u8.subarray(start, start + csize);

      var raw;
      if (method === 0) raw = data;
      else if (method === 8) raw = await inflateRaw(data);
      else continue;

      out[name] = dec.decode(raw);
    }

    return out;
  }

  // 解析工作簿
  async function parseWorkbook(u8, inflateRaw) {
    var files = await readZip(u8, inflateRaw, function(n) {
      return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(n);
    });

    var wbx = files['xl/workbook.xml'];
    if (!wbx) throw new Error('找不到 workbook.xml');

    var rels = {};
    (files['xl/_rels/workbook.xml.rels'] || '').replace(/<Relationship\b([^>]*)\/?>/g, function(m, a) {
      rels[attr(a, 'Id')] = attr(a, 'Target');
    });

    var ss = [];
    var sst = files['xl/sharedStrings.xml'] || '';
    sst.replace(/<si>([\s\S]*?)<\/si>/g, function(m, inner) {
      inner = inner.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
      var t = '';
      inner.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function(m2, x) {
        t += unesc(x);
      });
      ss.push(t);
    });

    var sheets = {}, order = [];
    var sheetRe = /<sheet\b([^>]*)\/>/g;
    var m;
    while ((m = sheetRe.exec(wbx))) {
      var sname = attr(m[1], 'name');
      var rid = attr(m[1], 'r:id');
      var target = rels[rid] || '';
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
      var xml = files['xl/' + target];
      order.push(sname);
      sheets[sname] = xml ? parseSheet(xml, ss) : { cells: {} };
    }

    return { sheets: sheets, order: order };
  }

  // 解析工作表
  function parseSheet(xml, ss) {
    var cells = {};
    var masters = {};
    var re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    var m;
    var pend = [];

    while ((m = re.exec(xml))) {
      var a = m[1], inner = m[2] || '';
      var r = attr(a, 'r');
      var t = attr(a, 't');
      var v = null, f = null;

      var vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
      if (vm) {
        var raw = unesc(vm[1]);
        if (t === 's') v = ss[+raw];
        else if (t === 'str') v = raw;
        else if (t === 'b') v = raw === '1';
        else if (t === 'e') v = { err: raw };
        else v = +raw;
      } else if (t === 'inlineStr') {
        var sv = '';
        inner.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, function(q, x) {
          sv += unesc(x);
        });
        v = sv;
      }

      var fm = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(inner);
      if (fm) {
        var fa = fm[1];
        var ftxt = fm[2] != null ? unesc(fm[2]) : '';
        if (attr(fa, 't') === 'shared') {
          var si = attr(fa, 'si');
          if (ftxt) {
            masters[si] = { r: r, f: ftxt };
            f = ftxt;
          } else pend.push({ r: r, si: si });
        } else if (ftxt) f = ftxt;
      }

      if (v === null && f === null) continue;
      cells[r] = { v: v, f: f };
    }

    for (var pi = 0; pi < pend.length; pi++) {
      var pd = pend[pi];
      var ms = masters[pd.si];
      if (!ms) continue;
      var pa = splitAddr(ms.r), pb = splitAddr(pd.r);
      var pf = shiftFormula(ms.f, pb.r - pa.r, pb.c - pa.c);
      if (!cells[pd.r]) cells[pd.r] = { v: null, f: pf };
      else cells[pd.r].f = pf;
    }

    return { cells: cells };
  }

  // 位移公式中的儲存格參照
  function shiftFormula(f, dr, dc) {
    var toks = tokenize(f);
    return toks.map(function(t) {
      if (t.t !== 'ref') return t.raw;
      function sh(p) {
        return { ac: p.ac, ar: p.ar, c: p.ac ? p.c : p.c + dc, r: p.ar ? p.r : p.r + dr };
      }
      return t.prefix + refText(sh(t.a)) + (t.b ? ':' + refText(sh(t.b)) : '');
    }).join('');
  }

  function refText(p) {
    return (p.ac ? '$' : '') + numToCol(p.c) + (p.ar ? '$' : '') + p.r;
  }

  function tokenize(src) {
    if (window.IRREngine && window.IRREngine.tokenize) return window.IRREngine.tokenize(src);
    throw new Error('IRREngine not loaded');
  }

  window.ExcelParser = {
    readZip: readZip,
    parseWorkbook: parseWorkbook,
    parseSheet: parseSheet,
    colToNum: colToNum,
    numToCol: numToCol,
    splitAddr: splitAddr,
    addr: addr,
    unesc: unesc,
    attr: attr,
    shiftFormula: shiftFormula
  };

})(typeof window !== 'undefined' ? window : globalThis);
