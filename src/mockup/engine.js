/* eslint-disable */
// @ts-nocheck
// Mini moteur d'affichage de la maquette ({{ }}, sc-for, sc-if, événements, état).
if (typeof window !== 'undefined' && !window.cfMount) {
(function () {
  var comp = null, tpl = null, root = null;
  function DCLogic(props) { this.props = props || {}; this.state = this.state || {}; }
  DCLogic.prototype.setState = function (p) {
    var next = typeof p === 'function' ? p(this.state) : p;
    this.state = Object.assign({}, this.state, next);
    render();
  };
  DCLogic.prototype.forceUpdate = function () { render(); };
  window.DCLogic = DCLogic;

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var FULL = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  function lookup(path, ctx) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    var parts = path.split('.'), v = ctx;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, ctx) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, ctx); return v == null ? '' : String(v); });
  }
  function renderNodes(list, ctx, out) {
    for (var i = 0; i < list.length; i++) renderNode(list[i], ctx, out);
    return out;
  }
  function renderNode(node, ctx, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.nodeValue, ctx))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-for') {
      var m = FULL.exec(node.getAttribute('list') || ''), items = m ? lookup(m[1], ctx) : [], as = node.getAttribute('as') || 'item';
      (items || []).forEach(function (it, idx) {
        var c = Object.create(ctx); c[as] = it; c.$index = idx;
        renderNodes(node.childNodes, c, out);
      });
      return;
    }
    if (tag === 'sc-if') {
      var mv = FULL.exec(node.getAttribute('value') || '');
      if (mv && lookup(mv[1], ctx)) renderNodes(node.childNodes, ctx, out);
      return;
    }
    var el = node.cloneNode(false);
    var attrs = Array.prototype.slice.call(node.attributes);
    attrs.forEach(function (a) {
      var name = a.name, val = a.value, full = FULL.exec(val), raw = full ? lookup(full[1], ctx) : undefined;
      if (name.indexOf('hint-') === 0) { el.removeAttribute(name); return; }
      if (name.indexOf('on') === 0 && full) {
        el.removeAttribute(name);
        if (typeof raw === 'function') el.addEventListener(name.slice(2), raw);
        return;
      }
      if (name === 'defaultvalue') { el.removeAttribute(name); el.defaultValue = full ? (raw == null ? '' : raw) : val; if (el.localName === 'textarea') el.textContent = el.defaultValue; return; }
      if (name === 'defaultchecked') { el.removeAttribute(name); var on = full ? !!raw : true; el.defaultChecked = on; el.checked = on; return; }
      if (name === 'checked' && full) { el.removeAttribute(name); el.defaultChecked = !!raw; el.checked = !!raw; return; }
      if ((name === 'disabled' || name === 'open' || name === 'selected' || name === 'readonly') && full) {
        if (raw) el.setAttribute(name, ''); else el.removeAttribute(name);
        return;
      }
      if (val.indexOf('{{') !== -1) { var out2 = full ? (raw == null ? '' : String(raw)) : interp(val, ctx);
        if (name === 'href') out2 = out2.replace(/^([A-Za-z0-9_]+)\.dc\.html/, '#$1');
        el.setAttribute(name, out2); }
    });
    var kids = renderNodes(node.childNodes, ctx, []);
    kids.forEach(function (k) { el.appendChild(k); });
    out.push(el);
  }
  function render() {
    if (!comp) return;
    var details = root.querySelectorAll('details'), openFlags = [];
    for (var i = 0; i < details.length; i++) openFlags.push(details[i].open);
    var fields = root.querySelectorAll('input[type=text], input:not([type]), textarea'), values = [];
    for (var j = 0; j < fields.length; j++) values.push(fields[j].value);
    var byId = {}; for (var jj = 0; jj < fields.length; jj++) if (fields[jj].id) byId[fields[jj].id] = fields[jj].value;
    var fk = root.querySelector('[data-form-key]'), formKey = fk ? fk.getAttribute('data-form-key') : null;
    var ae = document.activeElement, rIdx = -1, rN = 0;
    if (ae && ae.type === 'range' && root.contains(ae)) { var rs = root.querySelectorAll('input[type=range]'); rN = rs.length; rIdx = Array.prototype.indexOf.call(rs, ae); }
    var vals = comp.renderVals ? comp.renderVals() : {};
    var nodes = renderNodes(tpl.content.childNodes, vals || {}, []);
    root.textContent = '';
    nodes.forEach(function (n) { root.appendChild(n); });
    var d2 = root.querySelectorAll('details');
    if (d2.length === openFlags.length) for (var k = 0; k < d2.length; k++) d2[k].open = openFlags[k];
    var f2 = root.querySelectorAll('input[type=text], input:not([type]), textarea');
    var fk2 = root.querySelector('[data-form-key]'), sameForm = (fk2 ? fk2.getAttribute('data-form-key') : null) === formKey;
    if (sameForm && f2.length === values.length) { for (var l = 0; l < f2.length; l++) f2[l].value = values[l]; }
    else if (sameForm) { for (var l2 = 0; l2 < f2.length; l2++) if (f2[l2].id && byId.hasOwnProperty(f2[l2].id)) f2[l2].value = byId[f2[l2].id]; }
    if (rIdx >= 0) { var rs2 = root.querySelectorAll('input[type=range]'); if (rs2.length === rN) rs2[rIdx].focus({ preventScroll: true }); }
  }
  window.cfMount = function (Klass, tplEl, rootEl) {
    tpl = tplEl;
    comp = null;
    root = rootEl;
    comp = new Klass({});
    if (!comp.state) comp.state = {};
    render();
    if (comp.componentDidMount) comp.componentDidMount();
  };
})();


}
window.SCREENS = window.SCREENS || {};
export {};
