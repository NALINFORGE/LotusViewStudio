//#region \0rolldown/runtime.js
var e = (e, t) => () => (e && (t = e(e = 0)), t), t = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), n, r, i, a, o, s, c, l, u, ee = e((() => {
	n = globalThis, r = n.ShadowRoot && (n.ShadyCSS === void 0 || n.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, i = Symbol(), a = /* @__PURE__ */ new WeakMap(), o = class {
		constructor(e, t, n) {
			if (this._$cssResult$ = !0, n !== i) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
			this.cssText = e, this.t = t;
		}
		get styleSheet() {
			let e = this.o, t = this.t;
			if (r && e === void 0) {
				let n = t !== void 0 && t.length === 1;
				n && (e = a.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), n && a.set(t, e));
			}
			return e;
		}
		toString() {
			return this.cssText;
		}
	}, s = (e) => new o(typeof e == "string" ? e : e + "", void 0, i), c = (e, ...t) => new o(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
		if (!0 === e._$cssResult$) return e.cssText;
		if (typeof e == "number") return e;
		throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
	})(n) + e[r + 1], e[0]), e, i), l = (e, t) => {
		if (r) e.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
		else for (let r of t) {
			let t = document.createElement("style"), i = n.litNonce;
			i !== void 0 && t.setAttribute("nonce", i), t.textContent = r.cssText, e.appendChild(t);
		}
	}, u = r ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
		let t = "";
		for (let n of e.cssRules) t += n.cssText;
		return s(t);
	})(e) : e;
})), te, ne, re, ie, ae, oe, d, se, ce, le, f, p, ue, de, m, h = e((() => {
	ee(), {is: te, defineProperty: ne, getOwnPropertyDescriptor: re, getOwnPropertyNames: ie, getOwnPropertySymbols: ae, getPrototypeOf: oe} = Object, d = globalThis, se = d.trustedTypes, ce = se ? se.emptyScript : "", le = d.reactiveElementPolyfillSupport, f = (e, t) => e, p = {
		toAttribute(e, t) {
			switch (t) {
				case Boolean:
					e = e ? ce : null;
					break;
				case Object:
				case Array: e = e == null ? e : JSON.stringify(e);
			}
			return e;
		},
		fromAttribute(e, t) {
			let n = e;
			switch (t) {
				case Boolean:
					n = e !== null;
					break;
				case Number:
					n = e === null ? null : Number(e);
					break;
				case Object:
				case Array: try {
					n = JSON.parse(e);
				} catch {
					n = null;
				}
			}
			return n;
		}
	}, ue = (e, t) => !te(e, t), de = {
		attribute: !0,
		type: String,
		converter: p,
		reflect: !1,
		useDefault: !1,
		hasChanged: ue
	}, Symbol.metadata ??= Symbol("metadata"), d.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap(), m = class extends HTMLElement {
		static addInitializer(e) {
			this._$Ei(), (this.l ??= []).push(e);
		}
		static get observedAttributes() {
			return this.finalize(), this._$Eh && [...this._$Eh.keys()];
		}
		static createProperty(e, t = de) {
			if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
				let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
				r !== void 0 && ne(this.prototype, e, r);
			}
		}
		static getPropertyDescriptor(e, t, n) {
			let { get: r, set: i } = re(this.prototype, e) ?? {
				get() {
					return this[t];
				},
				set(e) {
					this[t] = e;
				}
			};
			return {
				get: r,
				set(t) {
					let a = r?.call(this);
					i?.call(this, t), this.requestUpdate(e, a, n);
				},
				configurable: !0,
				enumerable: !0
			};
		}
		static getPropertyOptions(e) {
			return this.elementProperties.get(e) ?? de;
		}
		static _$Ei() {
			if (this.hasOwnProperty(f("elementProperties"))) return;
			let e = oe(this);
			e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
		}
		static finalize() {
			if (this.hasOwnProperty(f("finalized"))) return;
			if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(f("properties"))) {
				let e = this.properties, t = [...ie(e), ...ae(e)];
				for (let n of t) this.createProperty(n, e[n]);
			}
			let e = this[Symbol.metadata];
			if (e !== null) {
				let t = litPropertyMetadata.get(e);
				if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
			}
			this._$Eh = /* @__PURE__ */ new Map();
			for (let [e, t] of this.elementProperties) {
				let n = this._$Eu(e, t);
				n !== void 0 && this._$Eh.set(n, e);
			}
			this.elementStyles = this.finalizeStyles(this.styles);
		}
		static finalizeStyles(e) {
			let t = [];
			if (Array.isArray(e)) {
				let n = new Set(e.flat(Infinity).reverse());
				for (let e of n) t.unshift(u(e));
			} else e !== void 0 && t.push(u(e));
			return t;
		}
		static _$Eu(e, t) {
			let n = t.attribute;
			return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
		}
		constructor() {
			super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
		}
		_$Ev() {
			this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
		}
		addController(e) {
			(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
		}
		removeController(e) {
			this._$EO?.delete(e);
		}
		_$E_() {
			let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
			for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
			e.size > 0 && (this._$Ep = e);
		}
		createRenderRoot() {
			let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
			return l(e, this.constructor.elementStyles), e;
		}
		connectedCallback() {
			this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
		}
		enableUpdating(e) {}
		disconnectedCallback() {
			this._$EO?.forEach((e) => e.hostDisconnected?.());
		}
		attributeChangedCallback(e, t, n) {
			this._$AK(e, n);
		}
		_$ET(e, t) {
			let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
			if (r !== void 0 && !0 === n.reflect) {
				let i = (n.converter?.toAttribute === void 0 ? p : n.converter).toAttribute(t, n.type);
				this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
			}
		}
		_$AK(e, t) {
			let n = this.constructor, r = n._$Eh.get(e);
			if (r !== void 0 && this._$Em !== r) {
				let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? p : e.converter;
				this._$Em = r;
				let a = i.fromAttribute(t, e.type);
				this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
			}
		}
		requestUpdate(e, t, n, r = !1, i) {
			if (e !== void 0) {
				let a = this.constructor;
				if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ue)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
				this.C(e, t, n);
			}
			!1 === this.isUpdatePending && (this._$ES = this._$EP());
		}
		C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
			n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
		}
		async _$EP() {
			this.isUpdatePending = !0;
			try {
				await this._$ES;
			} catch (e) {
				Promise.reject(e);
			}
			let e = this.scheduleUpdate();
			return e != null && await e, !this.isUpdatePending;
		}
		scheduleUpdate() {
			return this.performUpdate();
		}
		performUpdate() {
			if (!this.isUpdatePending) return;
			if (!this.hasUpdated) {
				if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
					for (let [e, t] of this._$Ep) this[e] = t;
					this._$Ep = void 0;
				}
				let e = this.constructor.elementProperties;
				if (e.size > 0) for (let [t, n] of e) {
					let { wrapped: e } = n, r = this[t];
					!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
				}
			}
			let e = !1, t = this._$AL;
			try {
				e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
			} catch (t) {
				throw e = !1, this._$EM(), t;
			}
			e && this._$AE(t);
		}
		willUpdate(e) {}
		_$AE(e) {
			this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
		}
		_$EM() {
			this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
		}
		get updateComplete() {
			return this.getUpdateComplete();
		}
		getUpdateComplete() {
			return this._$ES;
		}
		shouldUpdate(e) {
			return !0;
		}
		update(e) {
			this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
		}
		updated(e) {}
		firstUpdated(e) {}
	}, m.elementStyles = [], m.shadowRootOptions = { mode: "open" }, m[f("elementProperties")] = /* @__PURE__ */ new Map(), m[f("finalized")] = /* @__PURE__ */ new Map(), le?.({ ReactiveElement: m }), (d.reactiveElementVersions ??= []).push("2.1.2");
}));
//#endregion
//#region node_modules/lit-html/lit-html.js
function fe(e, t) {
	if (!C(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return me === void 0 ? t : me.createHTML(t);
}
function g(e, t, n = e, r) {
	if (t === O) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = S(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = g(e, i._$AS(e, t.values), i, r)), t;
}
var _, pe, v, me, he, y, ge, _e, b, x, S, C, ve, w, T, ye, be, E, xe, Se, Ce, we, D, O, k, Te, A, Ee, j, De, M, N, Oe, ke, Ae, je, Me, Ne, Pe = e((() => {
	_ = globalThis, pe = (e) => e, v = _.trustedTypes, me = v ? v.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, he = "$lit$", y = `lit$${Math.random().toFixed(9).slice(2)}$`, ge = "?" + y, _e = `<${ge}>`, b = document, x = () => b.createComment(""), S = (e) => e === null || typeof e != "object" && typeof e != "function", C = Array.isArray, ve = (e) => C(e) || typeof e?.[Symbol.iterator] == "function", w = "[ 	\n\f\r]", T = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ye = /-->/g, be = />/g, E = RegExp(`>|${w}(?:([^\\s"'>=/]+)(${w}*=${w}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), xe = /'/g, Se = /"/g, Ce = /^(?:script|style|textarea|title)$/i, we = (e) => (t, ...n) => ({
		_$litType$: e,
		strings: t,
		values: n
	}), D = we(1), we(2), we(3), O = Symbol.for("lit-noChange"), k = Symbol.for("lit-nothing"), Te = /* @__PURE__ */ new WeakMap(), A = b.createTreeWalker(b, 129), Ee = (e, t) => {
		let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = T;
		for (let t = 0; t < n; t++) {
			let n = e[t], s, c, l = -1, u = 0;
			for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === T ? c[1] === "!--" ? o = ye : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = E) : (Ce.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = E) : o = be : o === E ? c[0] === ">" ? (o = i ?? T, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? E : c[3] === "\"" ? Se : xe) : o === Se || o === xe ? o = E : o === ye || o === be ? o = T : (o = E, i = void 0);
			let ee = o === E && e[t + 1].startsWith("/>") ? " " : "";
			a += o === T ? n + _e : l >= 0 ? (r.push(s), n.slice(0, l) + he + n.slice(l) + y + ee) : n + y + (l === -2 ? t : ee);
		}
		return [fe(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
	}, j = class e {
		constructor({ strings: t, _$litType$: n }, r) {
			let i;
			this.parts = [];
			let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = Ee(t, n);
			if (this.el = e.createElement(l, r), A.currentNode = this.el.content, n === 2 || n === 3) {
				let e = this.el.content.firstChild;
				e.replaceWith(...e.childNodes);
			}
			for (; (i = A.nextNode()) !== null && c.length < s;) {
				if (i.nodeType === 1) {
					if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(he)) {
						let t = u[o++], n = i.getAttribute(e).split(y), r = /([.?@])?(.*)/.exec(t);
						c.push({
							type: 1,
							index: a,
							name: r[2],
							strings: n,
							ctor: r[1] === "." ? Oe : r[1] === "?" ? ke : r[1] === "@" ? Ae : N
						}), i.removeAttribute(e);
					} else e.startsWith(y) && (c.push({
						type: 6,
						index: a
					}), i.removeAttribute(e));
					if (Ce.test(i.tagName)) {
						let e = i.textContent.split(y), t = e.length - 1;
						if (t > 0) {
							i.textContent = v ? v.emptyScript : "";
							for (let n = 0; n < t; n++) i.append(e[n], x()), A.nextNode(), c.push({
								type: 2,
								index: ++a
							});
							i.append(e[t], x());
						}
					}
				} else if (i.nodeType === 8) if (i.data === ge) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(y, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += y.length - 1;
				}
				a++;
			}
		}
		static createElement(e, t) {
			let n = b.createElement("template");
			return n.innerHTML = e, n;
		}
	}, De = class {
		constructor(e, t) {
			this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
		}
		get parentNode() {
			return this._$AM.parentNode;
		}
		get _$AU() {
			return this._$AM._$AU;
		}
		u(e) {
			let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? b).importNode(t, !0);
			A.currentNode = r;
			let i = A.nextNode(), a = 0, o = 0, s = n[0];
			for (; s !== void 0;) {
				if (a === s.index) {
					let t;
					s.type === 2 ? t = new M(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new je(i, this, e)), this._$AV.push(t), s = n[++o];
				}
				a !== s?.index && (i = A.nextNode(), a++);
			}
			return A.currentNode = b, r;
		}
		p(e) {
			let t = 0;
			for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
		}
	}, M = class e {
		get _$AU() {
			return this._$AM?._$AU ?? this._$Cv;
		}
		constructor(e, t, n, r) {
			this.type = 2, this._$AH = k, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
		}
		get parentNode() {
			let e = this._$AA.parentNode, t = this._$AM;
			return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
		}
		get startNode() {
			return this._$AA;
		}
		get endNode() {
			return this._$AB;
		}
		_$AI(e, t = this) {
			e = g(this, e, t), S(e) ? e === k || e == null || e === "" ? (this._$AH !== k && this._$AR(), this._$AH = k) : e !== this._$AH && e !== O && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ve(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
		}
		O(e) {
			return this._$AA.parentNode.insertBefore(e, this._$AB);
		}
		T(e) {
			this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
		}
		_(e) {
			this._$AH !== k && S(this._$AH) ? this._$AA.nextSibling.data = e : this.T(b.createTextNode(e)), this._$AH = e;
		}
		$(e) {
			let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = j.createElement(fe(n.h, n.h[0]), this.options)), n);
			if (this._$AH?._$AD === r) this._$AH.p(t);
			else {
				let e = new De(r, this), n = e.u(this.options);
				e.p(t), this.T(n), this._$AH = e;
			}
		}
		_$AC(e) {
			let t = Te.get(e.strings);
			return t === void 0 && Te.set(e.strings, t = new j(e)), t;
		}
		k(t) {
			C(this._$AH) || (this._$AH = [], this._$AR());
			let n = this._$AH, r, i = 0;
			for (let a of t) i === n.length ? n.push(r = new e(this.O(x()), this.O(x()), this, this.options)) : r = n[i], r._$AI(a), i++;
			i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
		}
		_$AR(e = this._$AA.nextSibling, t) {
			for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
				let t = pe(e).nextSibling;
				pe(e).remove(), e = t;
			}
		}
		setConnected(e) {
			this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
		}
	}, N = class {
		get tagName() {
			return this.element.tagName;
		}
		get _$AU() {
			return this._$AM._$AU;
		}
		constructor(e, t, n, r, i) {
			this.type = 1, this._$AH = k, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = k;
		}
		_$AI(e, t = this, n, r) {
			let i = this.strings, a = !1;
			if (i === void 0) e = g(this, e, t, 0), a = !S(e) || e !== this._$AH && e !== O, a && (this._$AH = e);
			else {
				let r = e, o, s;
				for (e = i[0], o = 0; o < i.length - 1; o++) s = g(this, r[n + o], t, o), s === O && (s = this._$AH[o]), a ||= !S(s) || s !== this._$AH[o], s === k ? e = k : e !== k && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
			}
			a && !r && this.j(e);
		}
		j(e) {
			e === k ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
		}
	}, Oe = class extends N {
		constructor() {
			super(...arguments), this.type = 3;
		}
		j(e) {
			this.element[this.name] = e === k ? void 0 : e;
		}
	}, ke = class extends N {
		constructor() {
			super(...arguments), this.type = 4;
		}
		j(e) {
			this.element.toggleAttribute(this.name, !!e && e !== k);
		}
	}, Ae = class extends N {
		constructor(e, t, n, r, i) {
			super(e, t, n, r, i), this.type = 5;
		}
		_$AI(e, t = this) {
			if ((e = g(this, e, t, 0) ?? k) === O) return;
			let n = this._$AH, r = e === k && n !== k || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== k && (n === k || r);
			r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
		}
		handleEvent(e) {
			typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
		}
	}, je = class {
		constructor(e, t, n) {
			this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
		}
		get _$AU() {
			return this._$AM._$AU;
		}
		_$AI(e) {
			g(this, e);
		}
	}, Me = _.litHtmlPolyfillSupport, Me?.(j, M), (_.litHtmlVersions ??= []).push("3.3.3"), Ne = (e, t, n) => {
		let r = n?.renderBefore ?? t, i = r._$litPart$;
		if (i === void 0) {
			let e = n?.renderBefore ?? null;
			r._$litPart$ = i = new M(t.insertBefore(x(), e), e, void 0, n ?? {});
		}
		return i._$AI(e), i;
	};
})), P, F, Fe, Ie = e((() => {
	h(), h(), Pe(), Pe(), P = globalThis, F = class extends m {
		constructor() {
			super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
		}
		createRenderRoot() {
			let e = super.createRenderRoot();
			return this.renderOptions.renderBefore ??= e.firstChild, e;
		}
		update(e) {
			let t = this.render();
			this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ne(t, this.renderRoot, this.renderOptions);
		}
		connectedCallback() {
			super.connectedCallback(), this._$Do?.setConnected(!0);
		}
		disconnectedCallback() {
			super.disconnectedCallback(), this._$Do?.setConnected(!1);
		}
		render() {
			return O;
		}
	}, F._$litElement$ = !0, F.finalized = !0, P.litElementHydrateSupport?.({ LitElement: F }), Fe = P.litElementPolyfillSupport, Fe?.({ LitElement: F }), (P.litElementVersions ??= []).push("4.2.2");
})), Le = e((() => {})), Re = e((() => {
	h(), Pe(), Ie(), Le();
})), I, ze = e((() => {
	I = (e) => (t, n) => {
		n === void 0 ? customElements.define(e, t) : n.addInitializer(() => {
			customElements.define(e, t);
		});
	};
}));
//#endregion
//#region node_modules/@lit/reactive-element/decorators/property.js
function L(e) {
	return (t, n) => typeof n == "object" ? Ve(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
var Be, Ve, He = e((() => {
	h(), Be = {
		attribute: !0,
		type: String,
		converter: p,
		reflect: !1,
		hasChanged: ue
	}, Ve = (e = Be, t, n) => {
		let { kind: r, metadata: i } = n, a = globalThis.litPropertyMetadata.get(i);
		if (a === void 0 && globalThis.litPropertyMetadata.set(i, a = /* @__PURE__ */ new Map()), r === "setter" && ((e = Object.create(e)).wrapped = !0), a.set(n.name, e), r === "accessor") {
			let { name: r } = n;
			return {
				set(n) {
					let i = t.get.call(this);
					t.set.call(this, n), this.requestUpdate(r, i, e, !0, n);
				},
				init(t) {
					return t !== void 0 && this.C(r, void 0, e, t), t;
				}
			};
		}
		if (r === "setter") {
			let { name: r } = n;
			return function(n) {
				let i = this[r];
				t.call(this, n), this.requestUpdate(r, i, e, !0, n);
			};
		}
		throw Error("Unsupported decorator location: " + r);
	};
}));
//#endregion
//#region node_modules/@lit/reactive-element/decorators/state.js
function R(e) {
	return L({
		...e,
		state: !0,
		attribute: !1
	});
}
var Ue = e((() => {
	He();
})), We = e((() => {})), Ge = e((() => {})), Ke = e((() => {})), qe = e((() => {})), Je = e((() => {})), Ye = e((() => {})), Xe = e((() => {
	ze(), He(), Ue(), We(), Ge(), Ke(), qe(), Je(), Ye();
}));
//#endregion
//#region src/localization.ts
function Ze(e) {
	return typeof e == "string" ? e : e?.locale?.language ?? e?.language;
}
function z(e) {
	globalThis.LotusVisualI18n?.setHass?.(typeof e == "string" ? void 0 : e);
	let r = globalThis.LotusVisualI18n?.getPreference?.();
	let supported = globalThis.LotusVisualI18n?.languages?.map?.((e) => e.value) ?? ["en", "fr", "de"];
	if (r && r !== "auto") return supported.includes(r) ? r : "en";
	let t = (globalThis.LotusVisualI18n?.getAutomaticLanguage?.(typeof e == "string" ? void 0 : e) ?? Ze(e) ?? (typeof document < "u" ? document.documentElement.lang : void 0) ?? (typeof navigator < "u" ? navigator.language : void 0) ?? "en").trim().toLowerCase().replace("_", "-").split("-")[0];
	return supported.includes(t) ? t : "en";
}
function B(e, t, n = {}) {
	let r = z(e), i = Qe[r]?.[t];
	if (i === void 0 && !["en", "fr", "de"].includes(r)) {
		let a = Qe.fr?.[t] ?? Qe.en[t];
		let o = globalThis.LotusVisualI18n?.t?.(a, n, r);
		i = o && o !== a ? o : Qe.en[t];
	}
	i ??= Qe.en[t];
	return i.replace(/\{([a-zA-Z0-9_]+)\}/g, (e, t) => {
		let r = n[t];
		return r === void 0 ? e : String(r);
	});
}
function V(e, t, n) {
	return e === 1 ? t : n;
}
var Qe, H = e((() => {
	Qe = {
		en: {
			"metadata.description": "Picture Elements card enhanced with a five-level folder tree.",
			"defaults.cardTitle": "House floor plan",
			"defaults.unclassifiedElements": "Unclassified elements",
			"defaults.folderNumber": "Folder {number}",
			"defaults.subfolderNumber": "Subfolder {number}",
			"defaults.newAction": "New action",
			"defaults.newIcon": "New icon",
			"card.loading": "Loading LotusLayers…",
			"card.invalidConfig": "The LotusLayers configuration is invalid.",
			"card.helpersUnavailable": "Home Assistant has not made the card helpers available yet.",
			"card.loadingPictureElements": "Loading the Picture Elements card…",
			"editor.cardSettings": "Card settings",
			"editor.title": "Title",
			"editor.backgroundImage": "Background image",
			"editor.darkModeImage": "Dark mode image",
			"editor.optional": "Optional",
			"editor.cameraEntity": "Camera entity",
			"editor.cameraExample": "camera.example",
			"editor.aspectRatio": "Aspect ratio",
			"editor.theme": "Theme",
			"editor.cameraView": "Camera view",
			"editor.defaultValue": "Default value",
			"editor.automatic": "Automatic",
			"editor.live": "Live",
			"editor.helper": "The card keeps the native Picture Elements rendering. Folders are only used to organize controls in the editor. A branch can contain up to {maxDepth} consecutive folders. On a computer, the window can be resized from its bottom-right corner without exceeding the browser window. The header button immediately maximizes or restores it.",
			"editor.elementTree": "Element tree",
			"editor.elementCount.one": "{count} element",
			"editor.elementCount.other": "{count} elements",
			"editor.folderCount.one": "{count} folder",
			"editor.folderCount.other": "{count} folders",
			"editor.newRootFolder": "+ New root folder",
			"editor.depthNotice": "Maximum depth: {maxDepth} folders in the same branch. LotusLayers does not limit the number of branches or sibling folders.",
			"editor.back": "← Back",
			"editor.editElement": "Edit an element",
			"editor.unknownFolder": "Unknown folder",
			"editor.positionHint": "Click the floor plan preview to position the element. The left/top coordinates are then updated automatically.",
			"editor.loadingNativeEditor": "Loading the native Home Assistant editor…",
			"editor.restoreWindow": "Restore window size",
			"editor.enlargeWindow": "Enlarge window",
			"editor.helpersUnavailable": "Home Assistant card helpers are unavailable.",
			"editor.nativeEditorUnavailable": "The detailed element editor could not be loaded.",
			"editor.customCards": "Custom cards",
			"editor.customCardUnavailable": "This custom card is no longer available or is not loaded.",
			"editor.showYamlEditor": "YAML editor",
			"editor.showVisualEditor": "Visual editor",
			"editor.positionAndSize": "Position and size",
			"editor.positionX": "X position / left (%)",
			"editor.positionY": "Y position / top (%)",
			"editor.sizeMode": "Size mode",
			"editor.pixels": "Pixels",
			"editor.responsivePlan": "Responsive (% of floor plan)",
			"editor.widthWithUnit": "Width ({unit})",
			"editor.heightWithUnit": "Height ({unit})",
			"editor.autoProportions": "Automatic proportions",
			"editor.gridDimensions": "{columns} column(s) × {rows} row(s) — ratio {ratio}",
			"editor.defaultPixelSize": "Default pixel size: {width} × {height} px",
			"editor.visualStackSizeHelp": "Every Visual Stack Card cell remains square. Its height is calculated automatically from its row and column count. In Responsive mode, only its width is expressed as a percentage of the floor plan.",
			"editor.responsiveSizeHelp": "X and Y remain percentages of the floor plan. In Responsive mode, width and height are calculated relative to the floor plan.",
			"folder.open": "Open folder",
			"folder.collapse": "Collapse folder",
			"folder.color": "Folder identification color",
			"folder.name": "Folder name",
			"folder.level": "Level {depth} of {maxDepth}",
			"folder.contentCount": "Direct elements and elements in subfolders",
			"folder.subfolderCount.one": "{count} subfolder",
			"folder.subfolderCount.other": "{count} subfolders",
			"folder.visibilityHint": "Show or hide this folder and its entire branch on the floor plan",
			"folder.visible": "Visible",
			"folder.moveUp": "Move folder up within its branch",
			"folder.moveDown": "Move folder down within its branch",
			"folder.createSubfolder": "Create a subfolder",
			"folder.maxDepthReached": "The maximum depth of {maxDepth} folders has been reached",
			"folder.delete": "Delete the folder while keeping its elements and subfolders",
			"folder.empty": "This folder does not contain any elements or subfolders yet.",
			"folder.newElementType": "New element type",
			"folder.addElement": "+ Add an element",
			"folder.createSubfolderHere": "Create a subfolder in this folder",
			"folder.maxBranchDepth": "Maximum: {maxDepth} folders in the same branch",
			"folder.newSubfolder": "+ New subfolder",
			"element.type.stateBadge": "State badge",
			"element.type.stateIcon": "State icon",
			"element.type.stateLabel": "State label",
			"element.type.actionButton": "Action button",
			"element.type.icon": "Icon",
			"element.type.image": "Image",
			"element.type.conditional": "Conditional element",
			"element.type.visualStackCard": "Visual Stack Card",
			"element.type.customCard": "Custom card",
			"element.moveUp": "Move element up",
			"element.moveDown": "Move element down",
			"element.duplicate": "Duplicate element",
			"element.edit": "Edit element",
			"element.editButton": "Edit",
			"element.delete": "Delete element",
			"element.moveTo": "Move to",
			"element.chooseFolder": "Choose a folder…",
			"element.unlabeled": "Element without a label",
			"element.position": "Position: {left} / {top}"
		},
		fr: {
			"metadata.description": "Carte Éléments d’image enrichie avec une arborescence de dossiers sur cinq niveaux.",
			"defaults.cardTitle": "Plan de la maison",
			"defaults.unclassifiedElements": "Éléments non classés",
			"defaults.folderNumber": "Dossier {number}",
			"defaults.subfolderNumber": "Sous-dossier {number}",
			"defaults.newAction": "Nouvelle action",
			"defaults.newIcon": "Nouvelle icône",
			"card.loading": "Chargement de LotusLayers…",
			"card.invalidConfig": "La configuration LotusLayers est invalide.",
			"card.helpersUnavailable": "Home Assistant n’a pas encore rendu les outils de cartes disponibles.",
			"card.loadingPictureElements": "Chargement de la carte Éléments d’image…",
			"editor.cardSettings": "Paramètres de la carte",
			"editor.title": "Titre",
			"editor.backgroundImage": "Image de fond",
			"editor.darkModeImage": "Image en mode sombre",
			"editor.optional": "Facultatif",
			"editor.cameraEntity": "Entité caméra",
			"editor.cameraExample": "camera.exemple",
			"editor.aspectRatio": "Format d’image",
			"editor.theme": "Thème",
			"editor.cameraView": "Vue caméra",
			"editor.defaultValue": "Valeur par défaut",
			"editor.automatic": "Automatique",
			"editor.live": "Direct",
			"editor.helper": "La carte conserve le rendu natif « Éléments d’image ». Les dossiers servent uniquement à organiser les commandes dans l’éditeur. Une branche peut contenir jusqu’à {maxDepth} dossiers successifs. Sur ordinateur, la fenêtre se redimensionne depuis son angle inférieur droit, sans pouvoir dépasser la fenêtre du navigateur. Le bouton situé dans l’en-tête permet de l’agrandir ou de la restaurer immédiatement.",
			"editor.elementTree": "Arborescence des éléments",
			"editor.elementCount.one": "{count} élément",
			"editor.elementCount.other": "{count} éléments",
			"editor.folderCount.one": "{count} dossier",
			"editor.folderCount.other": "{count} dossiers",
			"editor.newRootFolder": "+ Nouveau dossier principal",
			"editor.depthNotice": "Profondeur maximale : {maxDepth} dossiers dans une même branche. Le nombre de branches et de dossiers frères n’est pas limité par LotusLayers.",
			"editor.back": "← Retour",
			"editor.editElement": "Modification d’un élément",
			"editor.unknownFolder": "Dossier inconnu",
			"editor.positionHint": "Cliquez sur l’aperçu du plan pour positionner l’élément. Les coordonnées gauche/haut sont alors mises à jour automatiquement.",
			"editor.loadingNativeEditor": "Chargement de l’éditeur natif Home Assistant…",
			"editor.restoreWindow": "Restaurer la taille de la fenêtre",
			"editor.enlargeWindow": "Agrandir la fenêtre",
			"editor.helpersUnavailable": "Les outils de cartes Home Assistant ne sont pas disponibles.",
			"editor.nativeEditorUnavailable": "L’éditeur détaillé des éléments n’a pas pu être chargé.",
			"editor.customCards": "Cartes personnalisées",
			"editor.customCardUnavailable": "Cette carte personnalisée n’est plus disponible ou n’est pas chargée.",
			"editor.showYamlEditor": "Éditeur YAML",
			"editor.showVisualEditor": "Éditeur visuel",
			"editor.positionAndSize": "Position et taille",
			"editor.positionX": "Position X / gauche (%)",
			"editor.positionY": "Position Y / haut (%)",
			"editor.sizeMode": "Mode de taille",
			"editor.pixels": "Pixels",
			"editor.responsivePlan": "Responsive (% du plan)",
			"editor.widthWithUnit": "Largeur ({unit})",
			"editor.heightWithUnit": "Hauteur ({unit})",
			"editor.autoProportions": "Proportions automatiques",
			"editor.gridDimensions": "{columns} colonne(s) × {rows} ligne(s) — ratio {ratio}",
			"editor.defaultPixelSize": "Taille pixel par défaut : {width} × {height} px",
			"editor.visualStackSizeHelp": "Chaque case de Visual Stack Card reste carrée. La hauteur est calculée automatiquement à partir du nombre de lignes et de colonnes. En mode Responsive, seule la largeur est exprimée en % du plan.",
			"editor.responsiveSizeHelp": "X et Y restent en pourcentage du plan. En mode Responsive, largeur et hauteur sont calculées par rapport au plan.",
			"folder.open": "Ouvrir le dossier",
			"folder.collapse": "Replier le dossier",
			"folder.color": "Couleur d’identification du dossier",
			"folder.name": "Nom du dossier",
			"folder.level": "Niveau {depth} sur {maxDepth}",
			"folder.contentCount": "Éléments directs et contenus dans les sous-dossiers",
			"folder.subfolderCount.one": "{count} sous-dossier",
			"folder.subfolderCount.other": "{count} sous-dossiers",
			"folder.visibilityHint": "Afficher ou masquer ce dossier et toute sa branche sur le plan",
			"folder.visible": "Visible",
			"folder.moveUp": "Monter le dossier dans sa branche",
			"folder.moveDown": "Descendre le dossier dans sa branche",
			"folder.createSubfolder": "Créer un sous-dossier",
			"folder.maxDepthReached": "La profondeur maximale de {maxDepth} dossiers est atteinte",
			"folder.delete": "Supprimer le dossier en conservant ses éléments et ses sous-dossiers",
			"folder.empty": "Ce dossier ne contient encore aucun élément ni sous-dossier.",
			"folder.newElementType": "Type du nouvel élément",
			"folder.addElement": "+ Ajouter un élément",
			"folder.createSubfolderHere": "Créer un sous-dossier dans ce dossier",
			"folder.maxBranchDepth": "Maximum : {maxDepth} dossiers dans une même branche",
			"folder.newSubfolder": "+ Nouveau sous-dossier",
			"element.type.stateBadge": "Badge d’état",
			"element.type.stateIcon": "Icône d’état",
			"element.type.stateLabel": "Libellé d’état",
			"element.type.actionButton": "Bouton d’action",
			"element.type.icon": "Icône",
			"element.type.image": "Image",
			"element.type.conditional": "Élément conditionnel",
			"element.type.visualStackCard": "Visual Stack Card",
			"element.type.customCard": "Carte personnalisée",
			"element.moveUp": "Monter l’élément",
			"element.moveDown": "Descendre l’élément",
			"element.duplicate": "Dupliquer l’élément",
			"element.edit": "Modifier l’élément",
			"element.editButton": "Modifier",
			"element.delete": "Supprimer l’élément",
			"element.moveTo": "Déplacer vers",
			"element.chooseFolder": "Choisir un dossier…",
			"element.unlabeled": "Élément sans libellé",
			"element.position": "Position : {left} / {top}"
		},
		de: {
			"metadata.description": "Picture-Elements-Karte mit einem Ordnerbaum über fünf Ebenen.",
			"defaults.cardTitle": "Hausgrundriss",
			"defaults.unclassifiedElements": "Nicht klassifizierte Elemente",
			"defaults.folderNumber": "Ordner {number}",
			"defaults.subfolderNumber": "Unterordner {number}",
			"defaults.newAction": "Neue Aktion",
			"defaults.newIcon": "Neues Symbol",
			"card.loading": "LotusLayers wird geladen…",
			"card.invalidConfig": "Die LotusLayers-Konfiguration ist ungültig.",
			"card.helpersUnavailable": "Home Assistant hat die Karten-Hilfsfunktionen noch nicht bereitgestellt.",
			"card.loadingPictureElements": "Picture-Elements-Karte wird geladen…",
			"editor.cardSettings": "Karteneinstellungen",
			"editor.title": "Titel",
			"editor.backgroundImage": "Hintergrundbild",
			"editor.darkModeImage": "Bild für den Dunkelmodus",
			"editor.optional": "Optional",
			"editor.cameraEntity": "Kamera-Entität",
			"editor.cameraExample": "camera.beispiel",
			"editor.aspectRatio": "Seitenverhältnis",
			"editor.theme": "Theme",
			"editor.cameraView": "Kameraansicht",
			"editor.defaultValue": "Standardwert",
			"editor.automatic": "Automatisch",
			"editor.live": "Live",
			"editor.helper": "Die Karte behält das native Picture-Elements-Rendering bei. Ordner dienen nur dazu, die Steuerelemente im Editor zu organisieren. Ein Zweig kann bis zu {maxDepth} aufeinanderfolgende Ordner enthalten. Auf einem Computer kann die Fenstergröße an der rechten unteren Ecke geändert werden, ohne das Browserfenster zu überschreiten. Mit der Schaltfläche in der Kopfzeile wird das Fenster sofort maximiert oder wiederhergestellt.",
			"editor.elementTree": "Elementstruktur",
			"editor.elementCount.one": "{count} Element",
			"editor.elementCount.other": "{count} Elemente",
			"editor.folderCount.one": "{count} Ordner",
			"editor.folderCount.other": "{count} Ordner",
			"editor.newRootFolder": "+ Neuer Hauptordner",
			"editor.depthNotice": "Maximale Tiefe: {maxDepth} Ordner im selben Zweig. LotusLayers begrenzt die Anzahl der Zweige oder gleichgeordneten Ordner nicht.",
			"editor.back": "← Zurück",
			"editor.editElement": "Element bearbeiten",
			"editor.unknownFolder": "Unbekannter Ordner",
			"editor.positionHint": "Klicken Sie auf die Vorschau des Grundrisses, um das Element zu positionieren. Die Koordinaten links/oben werden anschließend automatisch aktualisiert.",
			"editor.loadingNativeEditor": "Nativer Home-Assistant-Editor wird geladen…",
			"editor.restoreWindow": "Fenstergröße wiederherstellen",
			"editor.enlargeWindow": "Fenster vergrößern",
			"editor.helpersUnavailable": "Die Karten-Hilfsfunktionen von Home Assistant sind nicht verfügbar.",
			"editor.nativeEditorUnavailable": "Der detaillierte Elementeditor konnte nicht geladen werden.",
			"editor.customCards": "Benutzerdefinierte Karten",
			"editor.customCardUnavailable": "Diese benutzerdefinierte Karte ist nicht mehr verfügbar oder wurde nicht geladen.",
			"editor.showYamlEditor": "YAML-Editor",
			"editor.showVisualEditor": "Visueller Editor",
			"editor.positionAndSize": "Position und Größe",
			"editor.positionX": "X-Position / links (%)",
			"editor.positionY": "Y-Position / oben (%)",
			"editor.sizeMode": "Größenmodus",
			"editor.pixels": "Pixel",
			"editor.responsivePlan": "Responsiv (% des Grundrisses)",
			"editor.widthWithUnit": "Breite ({unit})",
			"editor.heightWithUnit": "Höhe ({unit})",
			"editor.autoProportions": "Automatische Proportionen",
			"editor.gridDimensions": "{columns} Spalte(n) × {rows} Zeile(n) — Verhältnis {ratio}",
			"editor.defaultPixelSize": "Standard-Pixelgröße: {width} × {height} px",
			"editor.visualStackSizeHelp": "Jede Zelle der Visual Stack Card bleibt quadratisch. Ihre Höhe wird automatisch aus der Anzahl der Zeilen und Spalten berechnet. Im responsiven Modus wird nur die Breite als Prozentsatz des Grundrisses angegeben.",
			"editor.responsiveSizeHelp": "X und Y bleiben Prozentsätze des Grundrisses. Im responsiven Modus werden Breite und Höhe relativ zum Grundriss berechnet.",
			"folder.open": "Ordner öffnen",
			"folder.collapse": "Ordner einklappen",
			"folder.color": "Kennfarbe des Ordners",
			"folder.name": "Ordnername",
			"folder.level": "Ebene {depth} von {maxDepth}",
			"folder.contentCount": "Direkte Elemente und Elemente in Unterordnern",
			"folder.subfolderCount.one": "{count} Unterordner",
			"folder.subfolderCount.other": "{count} Unterordner",
			"folder.visibilityHint": "Diesen Ordner und seinen gesamten Zweig im Grundriss ein- oder ausblenden",
			"folder.visible": "Sichtbar",
			"folder.moveUp": "Ordner innerhalb seines Zweigs nach oben verschieben",
			"folder.moveDown": "Ordner innerhalb seines Zweigs nach unten verschieben",
			"folder.createSubfolder": "Unterordner erstellen",
			"folder.maxDepthReached": "Die maximale Tiefe von {maxDepth} Ordnern wurde erreicht",
			"folder.delete": "Ordner löschen und seine Elemente sowie Unterordner beibehalten",
			"folder.empty": "Dieser Ordner enthält noch keine Elemente oder Unterordner.",
			"folder.newElementType": "Typ des neuen Elements",
			"folder.addElement": "+ Element hinzufügen",
			"folder.createSubfolderHere": "Unterordner in diesem Ordner erstellen",
			"folder.maxBranchDepth": "Maximum: {maxDepth} Ordner im selben Zweig",
			"folder.newSubfolder": "+ Neuer Unterordner",
			"element.type.stateBadge": "Status-Badge",
			"element.type.stateIcon": "Statussymbol",
			"element.type.stateLabel": "Statusbezeichnung",
			"element.type.actionButton": "Aktionsschaltfläche",
			"element.type.icon": "Symbol",
			"element.type.image": "Bild",
			"element.type.conditional": "Bedingtes Element",
			"element.type.visualStackCard": "Visual Stack Card",
			"element.type.customCard": "Benutzerdefinierte Karte",
			"element.moveUp": "Element nach oben verschieben",
			"element.moveDown": "Element nach unten verschieben",
			"element.duplicate": "Element duplizieren",
			"element.edit": "Element bearbeiten",
			"element.editButton": "Bearbeiten",
			"element.delete": "Element löschen",
			"element.moveTo": "Verschieben nach",
			"element.chooseFolder": "Ordner auswählen…",
			"element.unlabeled": "Element ohne Bezeichnung",
			"element.position": "Position: {left} / {top}"
		}
	};
})), U, $e = e((() => {
	U = Symbol("lotusPreviewClickCallback");
}));

function lotusNormalizeCustomCardType(e) {
	if (typeof e != "string") return;
	let t = e.trim();
	if (!t) return;
	return t.startsWith("custom:") ? t : `custom:${t}`;
}
function lotusCustomCardTag(e) {
	let t = lotusNormalizeCustomCardType(e);
	return t?.slice(7);
}
function lotusGetAvailableCustomCards() {
	let e = Array.isArray(window.customCards) ? window.customCards : [], t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = lotusNormalizeCustomCardType(n?.type), r = lotusCustomCardTag(e);
		if (!e || !r || r === "lotus-layers-card" || r === "lotus-card-element" || t.has(e)) continue;
		let i = customElements.get(r);
		if (typeof i != "function") continue;
		t.set(e, {
			type: e,
			tag: r,
			name: typeof n?.name == "string" && n.name.trim() ? n.name.trim() : r,
			description: typeof n?.description == "string" ? n.description : "",
			constructor: i,
			hasVisualEditor: typeof i.getConfigElement == "function" || typeof i.getConfigForm == "function"
		});
	}
	return [...t.values()].sort((e, t) => e.name.localeCompare(t.name, void 0, { sensitivity: "base" }));
}
function lotusGetCustomCardInfo(e) {
	let t = lotusNormalizeCustomCardType(e);
	return lotusGetAvailableCustomCards().find((e) => e.type === t);
}
function lotusCustomCardSelectionValue(e) {
	return `lotus-card::${lotusNormalizeCustomCardType(e)}`;
}
function lotusParseCustomCardSelection(e) {
	return typeof e == "string" && e.startsWith("lotus-card::") ? lotusNormalizeCustomCardType(e.slice(12)) : void 0;
}
const LOTUS_VISUAL_STACK_CELL_PX = 80;
const LOTUS_VISUAL_STACK_DEFAULT_ICON_SCALE = 20;
const LOTUS_VISUAL_STACK_MIN_SCALE = 8;
const LOTUS_VISUAL_STACK_MAX_SCALE = 100;
function lotusIsVisualStackCard(e) {
	let t = lotusNormalizeCustomCardType(e?.type);
	if (t === "custom:lotus-visual-stack" || t === "custom:visual-stack-card") return !0;
	return e?.type === "picture-elements" && e?.lotus_visual_stack && typeof e.lotus_visual_stack === "object";
}
function lotusVisualStackGrid(e) {
	let meta = e?.type === "picture-elements" && e?.lotus_visual_stack && typeof e.lotus_visual_stack === "object" ? e.lotus_visual_stack : void 0;
	let rawW = Array.isArray(meta?.size) ? Number(meta.size[0]) : Number(meta?.columns ?? e?.grid_columns) || 1;
	let rawH = Array.isArray(meta?.size) ? Number(meta.size[1]) : Number(meta?.rows ?? e?.grid_rows) || 1;
	rawW = Math.max(.01, rawW || 1), rawH = Math.max(.01, rawH || 1);
	let t, n;
	if (rawW >= rawH) t = 4, n = 4 * rawH / rawW;
	else n = 4, t = 4 * rawW / rawH;
	return { columns: t, rows: n, ratio: `${rawW} / ${rawH}`, widthPx: t * LOTUS_VISUAL_STACK_CELL_PX, heightPx: n * LOTUS_VISUAL_STACK_CELL_PX, frameWidth: rawW, frameHeight: rawH };
}
function lotusCssHalfSize(e) {
	let t = String(e ?? "").trim(), n = t.match(/^(-?\d+(?:\.\d+)?)(%|px)$/);
	return n ? `${Number(n[1]) / 2}${n[2]}` : `calc((${t || "0px"}) / 2)`;
}
function lotusVisualStackRuntimeElement(e) {
	if (!e || e.type !== "custom:lotus-card-element" || !lotusIsVisualStackCard(e.card)) return e;
	let t = { ...e, style: { ...e.style ?? {} } }, n = String(t.style.left ?? "50%").trim() || "50%", r = String(t.style.top ?? "50%").trim() || "50%", i = String(t.style.width ?? `${lotusVisualStackGrid(e.card).widthPx}px`).trim();
	// Keep the editor/saved geometry untouched. The actual host element applies
	// the centred -> left-edge conversion with !important after Home Assistant has
	// attached its .element class. This avoids the picture-elements default
	// translate(-50%, -50%) clipping the left half of nested Visual Stack cards.
	t.style["--lotus-vs-center-left"] = n;
	t.style["--lotus-vs-center-top"] = r;
	t.style["--lotus-vs-frame-width"] = i;
	t.style.overflow = "visible";
	return t;
}
function lotusResolveNativeVisualStack(e, hass) {
	if (!e || typeof e != "object") return;
	if (e.type === "picture-elements" && e.lotus_visual_stack && typeof e.lotus_visual_stack === "object") return ft(e);
	let t = lotusNormalizeCustomCardType(e.type);
	if (t !== "custom:lotus-visual-stack" && t !== "custom:visual-stack-card") return;
	let n = window.LotusVisualStack;
	if (typeof n?.toInternal != "function" || typeof n?.toNative != "function") return;
	try {
		return n.toNative(n.toInternal(e), hass);
	} catch (e) {
		globalThis.LotusVisualI18n?.debug?.("Unable to convert the legacy Visual Stack to native rendering", e);
	}
}
class LotusCardElement extends HTMLElement {
	constructor() {
		super(), this._buildVersion = 0, this._visualStackElements = [], this._visualStackElementConfigs = [], this._visualStackFrame = void 0, this._visualStackResizeObserver = void 0, this._root = this.attachShadow({ mode: "open" }), this._root.innerHTML = `
            <style>
                :host { display: block; box-sizing: border-box; min-width: 0; min-height: 0; overflow: visible; }
                #container { display: block; width: 100%; min-width: 0; min-height: 0; overflow: visible; }
                #container > * { display: block; width: 100%; min-width: 0; min-height: 0; max-width: none; box-sizing: border-box; }
                .lotus-vs-shell { width: 100%; min-width: 0; box-sizing: border-box; overflow: visible; }
                .lotus-vs-title {
                    box-sizing: border-box;
                    padding: 14px 16px 10px;
                    font-size: var(--ha-card-header-font-size, 18px);
                    font-weight: 600;
                    color: var(--primary-text-color);
                    background: var(--ha-card-background, var(--card-background-color, white));
                }
                .lotus-vs-frame {
                    position: relative;
                    display: block;
                    width: 100%;
                    min-width: 0;
                    min-height: 0;
                    box-sizing: border-box;
                    overflow: hidden;
                    container-type: inline-size;
                    border-radius: var(--ha-card-border-radius, 12px);
                    background: var(--ha-card-background, var(--card-background-color, white));
                }
                .lotus-vs-background {
                    position: absolute;
                    inset: 0;
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: fill;
                    pointer-events: none;
                    user-select: none;
                }
                .lotus-vs-native-element {
                    position: absolute !important;
                    box-sizing: border-box !important;
                    max-width: none !important;
                }
                .error {
                    box-sizing: border-box;
                    padding: 10px;
                    border-radius: var(--ha-card-border-radius, 12px);
                    background: var(--ha-card-background, var(--card-background-color, #fff));
                    color: var(--error-color, #db4437);
                    font-size: 12px;
                }
            </style>
            <div id="container"></div>
        `, this._container = this._root.querySelector("#container");
	}
	set hass(e) {
		this._hass = e;
		if (this._card) this._card.hass = e;
		for (let t of this._visualStackElements ?? []) t.hass = e;
	}
	get hass() {
		return this._hass;
	}
	set preview(e) {
		this._preview = !!e;
		if (this._card && !lotusIsVisualStackCard(this._config?.card)) this._card.preview = this._preview;
	}
	get preview() {
		return this._preview;
	}
	connectedCallback() {
		this._config && this._applyVisualStackHostGeometry(this._config);
		this._syncVisualStackResponsiveSizing();
	}
	disconnectedCallback() {
		this._disconnectVisualStackResizeObserver();
	}
	_disconnectVisualStackResizeObserver() {
		this._visualStackResizeObserver?.disconnect(), this._visualStackResizeObserver = void 0, this._visualStackFrame = void 0;
	}
	_visualStackIconScale(e) {
		let t = e?.style ?? {}, n = Number.parseFloat(String(t["--lotus-vs-icon-scale"] ?? ""));
		if (Number.isFinite(n) && n > 0) return Math.max(LOTUS_VISUAL_STACK_MIN_SCALE, Math.min(LOTUS_VISUAL_STACK_MAX_SCALE, n));
		let r = Number.parseFloat(String(t["--lotus-vs-icon-size"] ?? ""));
		if (Number.isFinite(r) && r > 0) return Math.max(LOTUS_VISUAL_STACK_MIN_SCALE, Math.min(LOTUS_VISUAL_STACK_MAX_SCALE, r));
		return LOTUS_VISUAL_STACK_DEFAULT_ICON_SCALE;
	}
	_visualStackVisibleText(e) {
		let t = e?.shadowRoot;
		if (!t) return "";
		let n = [...t.querySelectorAll("*")].filter((e) => e.children.length === 0).map((e) => String(e.textContent || "").trim()).filter(Boolean);
		return n.length ? n.sort((e, t) => t.length - e.length)[0] : String(t.textContent || "").trim();
	}
	_visualStackLeafPairs() {
		let pairs = [];
		let visit = (host, conf) => {
			if (!host || !conf) return;
			if (conf?.type === "conditional" && Array.isArray(conf.elements)) {
				let children = Array.isArray(host._elements) ? host._elements : [...(host.children ?? [])];
				for (let index = 0; index < conf.elements.length; index += 1) {
					visit(children[index], conf.elements[index]);
				}
				return;
			}
			pairs.push({ host, conf });
		};
		let hosts = this._visualStackElements ?? [], configs = this._visualStackElementConfigs ?? [];
		for (let index = 0; index < hosts.length; index += 1) visit(hosts[index], configs[index] ?? {});
		return pairs;
	}
	_syncVisualStackResponsiveSizing() {
		let e = this._visualStackFrame, pairs = this._visualStackLeafPairs();
		if (!e || !pairs.length) return;
		let frameRect = e.getBoundingClientRect?.(), frameWidth = frameRect?.width || e.clientWidth || 0, frameHeight = frameRect?.height || e.clientHeight || 0, grid = lotusVisualStackGrid(this._config?.card);
		if (!(frameWidth > 0) || !(frameHeight > 0)) return;
		let fallbackCell = grid.columns > 0 ? frameWidth / grid.columns : Math.min(frameWidth, frameHeight);
		for (let pair of pairs) {
			let host = pair.host, conf = pair.conf ?? {};
			if (!host) continue;
			let style = conf?.style ?? {}, regionWidthPct = Number.parseFloat(String(style["--lotus-vs-region-width"] ?? "")), regionHeightPct = Number.parseFloat(String(style["--lotus-vs-region-height"] ?? "")), regionWidth = Number.isFinite(regionWidthPct) && regionWidthPct > 0 ? frameWidth * regionWidthPct / 100 : fallbackCell, regionHeight = Number.isFinite(regionHeightPct) && regionHeightPct > 0 ? frameHeight * regionHeightPct / 100 : fallbackCell;
			if (conf?.type === "state-label") {
				let marker = String(style["--lotus-vs"] ?? ""), maxFontRaw = Number.parseFloat(String(style["--lotus-vs-font-max"] ?? "")), maxFont = Number.isFinite(maxFontRaw) && maxFontRaw > 0 ? maxFontRaw : marker.endsWith(":name") ? 14 : 12, linesRaw = Number.parseFloat(String(style["--lotus-vs-text-lines"] ?? "1")), lines = Number.isFinite(linesRaw) && linesRaw > 0 ? linesRaw : 1, hasVisual = String(style["--lotus-vs-has-visual"] ?? "") === "true", availableWidth = Math.max(1, regionWidth * (hasVisual ? .60 : .92)), availableHeight = Math.max(1, regionHeight / lines * .90), text = this._visualStackVisibleText(host), glyphs = Math.max(1, [...text].length || 1), byWidth = availableWidth / (glyphs * .58), byHeight = availableHeight / 1.18, fontSize = Math.max(1, Math.min(maxFont, byWidth, byHeight));
				host.style.setProperty("font-size", `${fontSize}px`, "important"), host.style.setProperty("line-height", "1.15", "important"), host.style.setProperty("text-overflow", "clip", "important");
				continue;
			}
			if (conf?.type !== "state-icon") continue;
			let scale = this._visualStackIconScale(conf), onlyVisual = String(style["--lotus-vs-icon-only"] ?? "") === "true", base = Math.min(regionWidth, regionHeight), size = Math.max(1, base * scale / 100);
			if (!onlyVisual) size = Math.max(1, Math.min(size, regionWidth * .42, regionHeight * .88));
			let color = String(style["--lotus-vs-icon-color"] ?? "").trim(), background = onlyVisual ? String(style["--lotus-vs-visual-background"] ?? "") !== "none" : String(style["--lotus-vs-icon-background"] ?? "") === "true";
			if (!onlyVisual) host.style.setProperty("width", `${size}px`, "important"), host.style.setProperty("height", `${size}px`, "important");
			host.style.setProperty("display", "grid", "important"), host.style.setProperty("place-items", "center", "important"), host.style.setProperty("overflow", "visible", "important"), host.style.setProperty("--mdc-icon-size", `${size}px`, "important");
			if (color) host.style.setProperty("--state-icon-color", color, "important"), host.style.setProperty("color", color, "important");
			let badge = host.shadowRoot?.querySelector("state-badge");
			if (!badge) continue;
			badge.style.setProperty("width", `${size}px`, "important"), badge.style.setProperty("height", `${size}px`, "important"), badge.style.setProperty("--mdc-icon-size", `${size}px`, "important"), badge.style.setProperty("display", "grid", "important"), badge.style.setProperty("place-items", "center", "important"), badge.style.setProperty("overflow", "visible", "important");
			if (color) badge.stateColor = !1, badge.color = color, badge.style.setProperty("--state-icon-color", color, "important"), badge.style.setProperty("color", color, "important");
			if (background) badge.style.setProperty("background", "var(--secondary-background-color)", "important"), badge.style.setProperty("border-radius", "50%", "important");
			else badge.style.setProperty("background", "transparent", "important");
			let stateIcon = badge.shadowRoot?.querySelector("ha-state-icon");
			if (stateIcon) stateIcon.style.setProperty("--mdc-icon-size", `${size}px`, "important"), color && stateIcon.style.setProperty("color", color, "important");
		}
	}
	_watchVisualStackResponsiveSizing(e) {
		this._disconnectVisualStackResizeObserver(), this._visualStackFrame = e;
		if (typeof ResizeObserver == "function") this._visualStackResizeObserver = new ResizeObserver(() => this._syncVisualStackResponsiveSizing()), this._visualStackResizeObserver.observe(e);
		window.requestAnimationFrame(() => this._syncVisualStackResponsiveSizing());
	}
	_applyVisualStackHostGeometry(e) {
		if (!lotusIsVisualStackCard(e?.card)) return;
		let t = e?.style ?? {}, n = String(t["--lotus-vs-center-left"] ?? t.left ?? "50%").trim() || "50%", r = String(t["--lotus-vs-center-top"] ?? t.top ?? "50%").trim() || "50%", i = String(t["--lotus-vs-frame-width"] ?? t.width ?? `${lotusVisualStackGrid(e.card).widthPx}px`).trim() || `${lotusVisualStackGrid(e.card).widthPx}px`;
		this.style.setProperty("left", `calc(${n} - ${lotusCssHalfSize(i)})`, "important");
		this.style.setProperty("top", r, "important");
		this.style.setProperty("width", i, "important");
		this.style.setProperty("height", "auto", "important");
		let grid = lotusVisualStackGrid(e.card);
		this.style.setProperty("aspect-ratio", `${grid.columns} / ${grid.rows}`, "important");
		this.style.setProperty("max-width", "none", "important");
		this.style.setProperty("transform", "translateY(-50%)", "important");
		this.style.setProperty("overflow", "visible", "important");
		this.style.setProperty("box-sizing", "border-box", "important");
	}
	_patchVisualStackImageElement(e, t) {
		if (!e || t?.type !== "image") return;
		let n = String(t?.style?.["--lotus-vs-image-fit"] ?? t?.style?.["object-fit"] ?? "contain");
		if (!["contain", "cover", "fill"].includes(n)) n = "contain";
		e.style.setProperty("display", "block", "important");
		e.style.setProperty("overflow", "visible", "important");
		let r = () => {
			let i = e.shadowRoot?.querySelector("hui-image");
			if (i) i.fitMode = n;
		};
		r(), e.updateComplete?.then?.(r), window.requestAnimationFrame(r);
	}
	_patchVisualStackIconElement(e, t) {
		if (!e || t?.type !== "state-icon") return;
		let n = t?.style ?? {}, r = String(n["--lotus-vs-icon-color"] ?? "").trim();
		if (r) e.style.setProperty("--state-icon-color", r, "important"), e.style.setProperty("color", r, "important");
		let i = () => this._syncVisualStackResponsiveSizing();
		i(), e.updateComplete?.then?.(() => {
			i();
			let t = e.shadowRoot?.querySelector("state-badge");
			t?.updateComplete?.then?.(i);
		}), window.requestAnimationFrame(i);
	}
	async _renderNativeVisualStack(t, buildVersion) {
		if (!window.loadCardHelpers) throw Error("Home Assistant card helpers are unavailable.");
		let r = await window.loadCardHelpers();
		if (buildVersion !== this._buildVersion) return;

		// Use Home Assistant's own picture-elements factory only as an element
		// factory. We deliberately do NOT nest the resulting picture-elements card:
		// nested cards are what caused the half-width clipping when a native image
		// element was present. The native elements are mounted directly in our frame.
		let i = r.createCardElement(t);
		i.hass = this._hass;
		let a = Array.isArray(i._elements) ? i._elements : [];
		if (!a.length && Array.isArray(t.elements) && t.elements.length) {
			throw Error("LotusLayers: Home Assistant n’a pas créé les éléments picture-elements attendus.");
		}

		let o = document.createElement("div");
		o.className = "lotus-vs-shell";
		if (t.title) {
			let e = document.createElement("div");
			e.className = "lotus-vs-title", e.textContent = t.title, o.appendChild(e);
		}
		let s = document.createElement("div");
		s.className = "lotus-vs-frame";
		let c = lotusVisualStackGrid(t), l = t.lotus_visual_stack ?? {};
		s.style.aspectRatio = `${c.columns} / ${c.rows}`;
		if (l.background_mode === "transparent") {
			s.style.setProperty("background", "transparent");
			s.style.setProperty("box-shadow", "none");
		} else if (l.background_mode === "color" && l.background_color) {
			s.style.setProperty("background", String(l.background_color));
		}
		if (typeof t.image === "string" && t.image) {
			let e = document.createElement("img");
			e.className = "lotus-vs-background", e.src = t.image, e.alt = "", s.appendChild(e);
		}

		let u = Array.isArray(t.elements) ? t.elements : [];
		this._visualStackElements = a, this._visualStackElementConfigs = u, this._visualStackFrame = s;
		for (let e = 0; e < a.length; e += 1) {
			let t = a[e], n = u[e] ?? {};
			if (!t) continue;
			if ("delegatedActions" in t) t.delegatedActions = !1;
			t.hass = this._hass, t.preview = !1, t.classList.add("lotus-vs-native-element");
			if (n?.type === "conditional") {
				// The native conditional element is a visibility container, not a
				// positioned picture-element. display:contents keeps its children
				// positioned against the Lotus frame while HA remains the condition engine.
				t.style.setProperty("display", "contents", "important");
				t.style.setProperty("position", "static", "important");
				t.style.setProperty("transform", "none", "important");
			} else {
				t.style.setProperty("position", "absolute", "important");
				if (!t.style.transform) t.style.setProperty("transform", "translate(-50%, -50%)");
			}
			this._patchVisualStackImageElement(t, n), this._patchVisualStackIconElement(t, n), s.appendChild(t);
		}
		o.appendChild(s);
		if (buildVersion !== this._buildVersion) return;
		this._card = void 0, this._cardType = "lotus-vs-native", this._visualStackElements = a, this._visualStackElementConfigs = u, this._container.className = "", this._container.replaceChildren(o), this._watchVisualStackResponsiveSizing(s);
	}
	_patchVisualStackNativeCard(e, t) {
		if (!e || !lotusIsVisualStackCard(t)) return;
		e.style.setProperty("display", "block", "important");
		e.style.setProperty("width", "100%", "important");
		e.style.setProperty("height", "auto", "important");
		e.style.setProperty("min-width", "0", "important");
		e.style.setProperty("max-width", "none", "important");
		e.style.setProperty("overflow", "visible", "important");
	}
	setConfig(e) {
		if (!e || typeof e != "object" || !e.card || typeof e.card != "object" || typeof e.card.type != "string") throw Error("LotusLayers: invalid embedded custom card configuration.");
		this._config = e, this._applyVisualStackHostGeometry(e), this._renderCard();
	}
	async _renderCard() {
		if (!this._config) return;
		let e = ++this._buildVersion, t = ft(this._config.card);
		try {
			if (lotusIsVisualStackCard(t)) {
				let n = lotusResolveNativeVisualStack(t, this._hass);
				let legacyType = lotusNormalizeCustomCardType(t?.type);
				if (!n && (legacyType === "custom:lotus-visual-stack" || legacyType === "custom:visual-stack-card") && !customElements.get("lotus-visual-stack")) {
					await Promise.race([customElements.whenDefined("lotus-visual-stack"), new Promise((resolve) => setTimeout(resolve, 1200))]);
					if (e !== this._buildVersion) return;
					n = lotusResolveNativeVisualStack(t, this._hass);
				}
				if (n) {
					if (!n.aspect_ratio) {
						let e = lotusVisualStackGrid(n);
						n.aspect_ratio = `${e.columns}:${e.rows}`;
					}
					await this._renderNativeVisualStack(n, e);
					return;
				}
			}
			this._disconnectVisualStackResizeObserver(), this._visualStackElements = [], this._visualStackElementConfigs = [];
			if (this._card && this._cardType === t.type) try {
				this._card.setConfig(t), this._card.hass = this._hass, this._patchVisualStackNativeCard(this._card, t);
				return;
			} catch {
				this._card.remove(), this._card = void 0;
			}
			if (!window.loadCardHelpers) throw Error("Home Assistant card helpers are unavailable.");
			let n = await window.loadCardHelpers();
			if (e !== this._buildVersion) return;
			let r = n.createCardElement(t);
			this._patchVisualStackNativeCard(r, t);
			r.hass = this._hass, r.preview = this._preview, r.addEventListener("ll-rebuild", (e) => {
				e.stopPropagation(), this._renderCard();
			}, { once: !0 }), this._card = r, this._cardType = t.type, this._container.className = "", this._container.replaceChildren(r);
		} catch (e) {
			let t = e instanceof Error ? e.message : String(e);
			this._disconnectVisualStackResizeObserver(), this._card = void 0, this._cardType = void 0, this._visualStackElements = [], this._visualStackElementConfigs = [], this._container.className = "error", this._container.textContent = `LotusLayers : ${t}`;
		}
	}
}
customElements.get("lotus-card-element") || customElements.define("lotus-card-element", LotusCardElement);
//#endregion
//#region src/utils/layer-tree.ts
function W(e) {
	return e.map((e) => ({
		...e,
		elements: [...e.elements ?? []],
		children: e.children?.length ? W(e.children) : void 0
	}));
}
function G(e, t) {
	if (Array.isArray(e)) for (let n of e) {
		if (n.id === t) return n;
		let e = G(n.children, t);
		if (e) return e;
	}
}
function et(e, t, n, r = 1) {
	for (let i = 0; i < e.length; i += 1) {
		let a = e[i];
		if (a.id === t) return {
			layer: a,
			siblings: e,
			index: i,
			parent: n,
			depth: r
		};
		if (a.children?.length) {
			let e = et(a.children, t, a, r + 1);
			if (e) return e;
		}
	}
}
function tt(e, t) {
	let n = et(e, t.id);
	return n ? (n.siblings[n.index] = t, !0) : !1;
}
function nt(e, t = [], n = 1) {
	return Array.isArray(e) ? e.flatMap((e) => {
		let r = [...t, e.name];
		return [{
			id: e.id,
			name: e.name,
			path: r.join(" / "),
			depth: n
		}, ...nt(e.children, r, n + 1)];
	}) : [];
}
function rt(e) {
	return (e.elements?.length ?? 0) + (e.children ?? []).reduce((e, t) => e + rt(t), 0);
}
function it(e) {
	return (e ?? []).reduce((e, t) => e + rt(t), 0);
}
function at(e) {
	let t = Array.isArray(e.elements) ? e.elements : [], n = Array.isArray(e.children) ? e.children : [];
	return [...t, ...n.flatMap((e) => at(e))];
}
var ot = e((() => {}));
//#endregion
//#region src/utils/flatten-layers.ts
function st() {
	return typeof crypto < "u" && "randomUUID" in crypto ? `layer-${crypto.randomUUID()}` : `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function K(e = Y.unclassifiedName, t = []) {
	return {
		id: st(),
		name: e,
		color: J,
		collapsed: !1,
		visible: !0,
		elements: t.map((e) => ({ ...e }))
	};
}
function ct(e, t, n, r = 1, i = Y) {
	let a = typeof e.id == "string" && e.id.trim() ? e.id.trim() : st();
	for (; n.has(a);) a = st();
	n.add(a);
	let o = Array.isArray(e.elements) ? e.elements.map((e) => ({ ...e })) : [], s = Array.isArray(e.children) ? e.children : [];
	r >= 5 && s.length > 0 && o.push(...s.flatMap((e) => at(e)).map((e) => ({ ...e })));
	let c = r < 5 ? s.map((e, t) => ct(e, t, n, r + 1, i)) : [], l = {
		id: a,
		name: typeof e.name == "string" && e.name.trim() ? e.name : i.folderName(t + 1),
		color: typeof e.color == "string" && e.color.trim() ? e.color : J,
		collapsed: e.collapsed === !0,
		visible: e.visible !== !1,
		elements: o
	};
	return c.length > 0 && (l.children = c), l;
}
function q(e, t = Y) {
	let { elements: n, layers: r, ...i } = e, a = /* @__PURE__ */ new Set(), o = Array.isArray(r) ? r.map((e, n) => ct(e, n, a, 1, t)) : [];
	if (Array.isArray(n) && n.length > 0) {
		let e = new Set([
			t.unclassifiedName,
			"Unclassified elements",
			"Éléments non classés"
		]), r = o.find((t) => e.has(t.name));
		r ? r.elements.push(...n.map((e) => ({ ...e }))) : o.push(K(t.unclassifiedName, n));
	}
	return o.length === 0 && o.push(K(t.unclassifiedName)), {
		...i,
		type: e.type || "custom:lotus-layers-card",
		layers: o
	};
}
function lt(e) {
	return e.visible === !1 ? [] : [...e.elements ?? []].map((e) => lotusVisualStackRuntimeElement(e)).concat((e.children ?? []).flatMap((e) => lt(e)));
}
function ut(e) {
	return Array.isArray(e) ? e.flatMap((e) => lt(e)) : [];
}
function dt(e) {
	let { layers: t, elements: n, type: r, ...i } = q(e);
	return delete i[U], {
		...i,
		type: "picture-elements",
		elements: ut(t)
	};
}
function ft(e) {
	return typeof structuredClone == "function" ? structuredClone(e) : JSON.parse(JSON.stringify(e));
}
function pt(e) {
	return e && /^#[0-9a-f]{6}$/i.test(e.trim()) ? e.trim() : J;
}
var J, Y, mt = e((() => {
	$e(), ot(), J = "#03a9f4", Y = {
		unclassifiedName: "Unclassified elements",
		folderName: (e) => `Folder ${e}`
	};
}));
//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorate.js
function X(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
var ht = e((() => {})), Z, gt = e((() => {
	Re(), Xe(), H(), ht(), Z = class extends F {
		constructor(...e) {
			super(...e), this.index = 0, this.total = 0, this.layerId = "", this.layerOptions = [], this.language = "en";
		}
		render() {
			let e = this._getPosition(), t = this.layerOptions.filter((e) => e.id !== this.layerId);
			return D`
            <div class="row">
                <div class="summary">
                    <strong>${this._getTypeLabel(this.element.type)}</strong>
                    <span class="secondary">${this._getSecondaryDescription()}</span>
                    ${e ? D`<span class="position">${e}</span>` : ""}
                </div>

                <div class="actions">
                    <button
                        type="button"
                        title=${B(this.language, "element.moveUp")}
                        ?disabled=${this.index <= 0}
                        @click=${() => this._emitAction("move-up")}
                     aria-label=${B(this.language, "element.moveUp")}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                    <button
                        type="button"
                        title=${B(this.language, "element.moveDown")}
                        ?disabled=${this.index >= this.total - 1}
                        @click=${() => this._emitAction("move-down")}
                     aria-label=${B(this.language, "element.moveDown")}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                    <button
                        type="button"
                        title=${B(this.language, "element.duplicate")}
                        @click=${() => this._emitAction("duplicate")}
                     aria-label=${B(this.language, "element.duplicate")}><ha-icon icon="mdi:content-copy"></ha-icon></button>
                    <button
                        type="button"
                        class="edit"
                        title=${B(this.language, "element.edit")}
                        @click=${() => this._emitAction("edit")}
                     aria-label=${B(this.language, "element.edit")}><ha-icon icon="mdi:pencil-outline"></ha-icon></button>
                    <button
                        type="button"
                        class="danger"
                        title=${B(this.language, "element.delete")}
                        @click=${() => this._emitAction("delete")}
                    ><ha-icon icon="mdi:delete-outline"></ha-icon></button>
                </div>
            </div>

            ${t.length > 0 ? D`
                    <div class="move-row">
                        <label>
                            ${B(this.language, "element.moveTo")}
                            <select @change=${this._moveToLayer}>
                                <option value="">${B(this.language, "element.chooseFolder")}</option>
                                ${t.map((e) => D`
                                        <option value=${e.id}>${e.path}</option>
                                    `)}
                            </select>
                        </label>
                    </div>
                ` : ""}
        `;
		}
		_emitAction(e, t) {
			this.dispatchEvent(new CustomEvent("lotus-element-action", {
				detail: {
					action: e,
					layerId: this.layerId,
					elementIndex: this.index,
					targetLayerId: t
				},
				bubbles: !0,
				composed: !0
			}));
		}
		_moveToLayer(e) {
			let t = e.currentTarget, n = t.value;
			n && this._emitAction("move-to-layer", n), t.value = "";
		}
		_getTypeLabel(e) {
			if (e === "custom:lotus-card-element") {
				if (lotusIsVisualStackCard(this.element?.card)) return "Lotus Stack";
				return this.element?.card?.type ? this.element.card.type : B(this.language, "element.type.customCard");
			}
			return {
				"state-badge": B(this.language, "element.type.stateBadge"),
				"state-icon": B(this.language, "element.type.stateIcon"),
				"state-label": B(this.language, "element.type.stateLabel"),
				"action-button": B(this.language, "element.type.actionButton"),
				icon: B(this.language, "element.type.icon"),
				image: B(this.language, "element.type.image"),
				conditional: B(this.language, "element.type.conditional"),
				"custom:visual-stack-card": B(this.language, "element.type.visualStackCard")
			}[e] ?? e;
		}
		_getSecondaryDescription() {
			let e = this.element;
			if (e.type === "custom:lotus-card-element" && e.card) {
				if (lotusIsVisualStackCard(e.card)) {
					let t = lotusVisualStackGrid(e.card);
					return `Carte Lotus · ${t.columns} × ${t.rows}`;
				}
				let t = lotusGetCustomCardInfo(e.card.type);
				return t?.name ?? e.card.type ?? B(this.language, "element.unlabeled");
			}
			if (typeof e.title == "string" && e.title.trim()) return e.title;
			if (typeof e.entity == "string" && e.entity.trim()) return e.entity;
			if (typeof e.icon == "string" && e.icon.trim()) return e.icon;
			if (typeof e.image == "string" && e.image.trim()) return e.image;
			if (typeof e.action == "string" && e.action.trim()) return e.action;
			if (typeof e.service == "string" && e.service.trim()) return e.service;
			if (e.type === "conditional") {
				let t = Array.isArray(e.elements) ? e.elements.length : 0;
				return B(this.language, V(t, "editor.elementCount.one", "editor.elementCount.other"), { count: t });
			}
			return B(this.language, "element.unlabeled");
		}
		_getPosition() {
			let e = this.element.style, t = e?.left, n = e?.top;
			if (typeof t == "string" && typeof n == "string") return B(this.language, "element.position", {
				left: t,
				top: n
			});
		}
		static {
			this.styles = c`
        :host {
            display: block;
            border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.24));
        }

        .row {
            display: flex;
            align-items: center;
            gap: 12px;
            min-height: 62px;
            padding: 8px 10px;
        }

        .summary {
            display: flex;
            flex: 1;
            min-width: 0;
            flex-direction: column;
            gap: 2px;
        }

        strong,
        .secondary,
        .position {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        strong {
            color: var(--primary-text-color);
            font-size: 14px;
        }

        .secondary {
            color: var(--secondary-text-color);
            font-size: 13px;
        }

        .position {
            color: var(--secondary-text-color);
            font-size: 11px;
        }

        .actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        button,
        select {
            box-sizing: border-box;
            min-height: 32px;
            border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
            border-radius: 6px;
            background: var(--secondary-background-color, transparent);
            color: var(--primary-text-color);
            font: inherit;
        }

        button {
            min-width: 32px;
            padding: 4px 8px;
            cursor: pointer;
        }

        button:hover:not(:disabled) {
            border-color: var(--primary-color);
        }

        button:disabled {
            cursor: default;
            opacity: 0.35;
        }

        .edit {
            min-width: auto;
        }

        .danger {
            color: var(--error-color, #db4437);
            font-size: 20px;
            line-height: 1;
        }

        .move-row {
            padding: 0 10px 10px;
        }

        .move-row label {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            color: var(--secondary-text-color);
            font-size: 12px;
        }

        select {
            max-width: 230px;
            padding: 4px 8px;
        }

        @media (max-width: 700px) {
            .row {
                align-items: stretch;
                flex-direction: column;
            }

            .actions {
                justify-content: flex-end;
                flex-wrap: wrap;
            }

            .move-row label {
                align-items: stretch;
                flex-direction: column;
            }

            select {
                max-width: none;
                width: 100%;
            }
        }
    `;
		}
	}, X([L({ attribute: !1 })], Z.prototype, "element", void 0), X([L({ type: Number })], Z.prototype, "index", void 0), X([L({ type: Number })], Z.prototype, "total", void 0), X([L({ type: String })], Z.prototype, "layerId", void 0), X([L({ attribute: !1 })], Z.prototype, "layerOptions", void 0), X([L({ type: String })], Z.prototype, "language", void 0), Z = X([I("lotus-layer-row")], Z);
})), Q, _t = e((() => {
	Re(), Xe(), H(), mt(), ot(), gt(), ht(), Q = class extends F {
		constructor(...e) {
			super(...e), this.index = 0, this.total = 0, this.depth = 1, this.layerOptions = [], this.customCardOptions = [], this.language = "en", this._newElementType = "state-icon";
		}
		render() {
			let e = this.layer.elements?.length ?? 0, t = rt(this.layer), n = this.layer.children ?? [], r = pt(this.layer.color), i = this.depth < 5, a = B(this.language, V(t, "editor.elementCount.one", "editor.elementCount.other"), { count: t }), o = B(this.language, V(n.length, "folder.subfolderCount.one", "folder.subfolderCount.other"), { count: n.length });
			return D`
            <section
                class="folder ${this.layer.visible === !1 ? "hidden-layer" : ""}"
                style=${`--lotus-layer-color: ${r}`}
            >
                <header>
                    <button
                        type="button"
                        class="collapse"
                        title=${this.layer.collapsed ? B(this.language, "folder.open") : B(this.language, "folder.collapse")}
                        @click=${this._toggleCollapsed}
                    ><ha-icon icon=${this.layer.collapsed ? "mdi:chevron-right" : "mdi:chevron-down"}></ha-icon></button>

                    <input
                        class="color"
                        type="color"
                        title=${B(this.language, "folder.color")}
                        .value=${r}
                        @input=${this._changeColor}
                    />

                    <div class="identity">
                        <input
                            class="name"
                            type="text"
                            aria-label=${B(this.language, "folder.name")}
                            .value=${this.layer.name}
                            @input=${this._changeName}
                        />
                        <span class="depth">${B(this.language, "folder.level", {
				depth: this.depth,
				maxDepth: 5
			})}</span>
                    </div>

                    <span
                        class="count"
                        title=${B(this.language, "folder.contentCount")}
                    >
                        ${a}
                        ${n.length > 0 ? D` · ${o}` : k}
                    </span>

                    <label
                        class="visibility"
                        title=${B(this.language, "folder.visibilityHint")}
                    >
                        <input
                            type="checkbox"
                            .checked=${this.layer.visible !== !1}
                            @change=${this._changeVisibility}
                        />
                        ${B(this.language, "folder.visible")}
                    </label>

                    <div class="folder-actions">
                        <button
                            type="button"
                            title=${B(this.language, "folder.moveUp")}
                            aria-label=${B(this.language, "folder.moveUp")}
                            ?disabled=${this.index <= 0}
                            @click=${() => this._emitLayerAction("move-up")}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                        <button
                            type="button"
                            title=${B(this.language, "folder.moveDown")}
                            aria-label=${B(this.language, "folder.moveDown")}
                            ?disabled=${this.index >= this.total - 1}
                            @click=${() => this._emitLayerAction("move-down")}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                        <button
                            type="button"
                            class="add-folder"
                            title=${i ? B(this.language, "folder.createSubfolder") : B(this.language, "folder.maxDepthReached", { maxDepth: 5 })}
                            ?disabled=${!i}
                            @click=${() => this._emitLayerAction("add-child")}
                        ><ha-icon icon="mdi:folder-plus-outline"></ha-icon></button>
                        <button
                            type="button"
                            class="danger"
                            title=${B(this.language, "folder.delete")}
                            @click=${() => this._emitLayerAction("delete")}
                        ><ha-icon icon="mdi:delete-outline"></ha-icon></button>
                    </div>
                </header>

                ${this.layer.collapsed ? k : D`
                        <div class="content">
                            ${e === 0 && n.length === 0 ? D`<p class="empty">${B(this.language, "folder.empty")}</p>` : k}

                            ${this.layer.elements.map((t, n) => D`
                                    <lotus-layer-row
                                        .element=${t}
                                        .index=${n}
                                        .total=${e}
                                        .layerId=${this.layer.id}
                                        .layerOptions=${this.layerOptions}
                                        .language=${this.language}
                                    ></lotus-layer-row>
                                `)}

                            <div class="folder-tools">
                                <div class="add-element">
                                    <select
                                        aria-label=${B(this.language, "folder.newElementType")}
                                        .value=${this._newElementType}
                                        @change=${this._selectElementType}
                                    >
                                        <option value="state-icon">${B(this.language, "element.type.stateIcon")}</option>
                                        <option value="state-badge">${B(this.language, "element.type.stateBadge")}</option>
                                        <option value="state-label">${B(this.language, "element.type.stateLabel")}</option>
                                        <option value="action-button">${B(this.language, "element.type.actionButton")}</option>
                                        <option value="icon">${B(this.language, "element.type.icon")}</option>
                                        <option value="image">${B(this.language, "element.type.image")}</option>
                                        <option value="conditional">${B(this.language, "element.type.conditional")}</option>
                                        ${this.customCardOptions.length > 0 ? D`
                                                <optgroup label=${B(this.language, "editor.customCards")}>
                                                    ${this.customCardOptions.map((e) => D`
                                                            <option value=${lotusCustomCardSelectionValue(e.type)}>
                                                                ${e.name}${e.hasVisualEditor ? "" : " · YAML"}
                                                            </option>
                                                        `)}
                                                </optgroup>
                                            ` : k}
                                    </select>
                                    <button type="button" class="primary" title=${B(this.language, "folder.addElement")} aria-label=${B(this.language, "folder.addElement")} @click=${this._addElement}>
                                        <ha-icon icon="mdi:plus"></ha-icon>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    class="secondary-action"
                                    ?disabled=${!i}
                                    title=${i ? B(this.language, "folder.createSubfolderHere") : B(this.language, "folder.maxBranchDepth", { maxDepth: 5 })}
                                    aria-label=${i ? B(this.language, "folder.createSubfolderHere") : B(this.language, "folder.maxBranchDepth", { maxDepth: 5 })}
                                    @click=${() => this._emitLayerAction("add-child")}
                                >
                                    <ha-icon icon="mdi:folder-plus-outline"></ha-icon>
                                </button>
                            </div>

                            ${n.length > 0 ? D`
                                    <div class="children">
                                        ${n.map((e, t) => D`
                                                <lotus-layer-folder
                                                    .layer=${e}
                                                    .index=${t}
                                                    .total=${n.length}
                                                    .depth=${this.depth + 1}
                                                    .layerOptions=${this.layerOptions}
                                                    .customCardOptions=${this.customCardOptions}
                                                    .language=${this.language}
                                                ></lotus-layer-folder>
                                            `)}
                                    </div>
                                ` : k}
                        </div>
                    `}
            </section>
        `;
		}
		_updateLayer(e) {
			this.dispatchEvent(new CustomEvent("lotus-layer-changed", {
				detail: {
					...this.layer,
					...e
				},
				bubbles: !0,
				composed: !0
			}));
		}
		_toggleCollapsed() {
			this._updateLayer({ collapsed: !this.layer.collapsed });
		}
		_changeColor(e) {
			this._updateLayer({ color: e.currentTarget.value });
		}
		_changeName(e) {
			this._updateLayer({ name: e.currentTarget.value });
		}
		_changeVisibility(e) {
			this._updateLayer({ visible: e.currentTarget.checked });
		}
		_emitLayerAction(e) {
			this.dispatchEvent(new CustomEvent("lotus-layer-action", {
				detail: {
					action: e,
					layerId: this.layer.id
				},
				bubbles: !0,
				composed: !0
			}));
		}
		_selectElementType(e) {
			this._newElementType = e.currentTarget.value;
		}
		_addElement() {
			let e = lotusParseCustomCardSelection(this._newElementType);
			if (e && !lotusGetCustomCardInfo(e)) return;
			this.dispatchEvent(new CustomEvent("lotus-add-element", {
				detail: {
					layerId: this.layer.id,
					elementType: this._newElementType
				},
				bubbles: !0,
				composed: !0
			}));
		}
		static {
			this.styles = c`
        :host {
            display: block;
        }

        .folder {
            overflow: hidden;
            border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
            border-left: 5px solid var(--lotus-layer-color);
            border-radius: 10px;
            background: var(--card-background-color, var(--ha-card-background, #fff));
        }

        .hidden-layer {
            opacity: 0.68;
        }

        header {
            display: grid;
            grid-template-columns: 34px 38px minmax(0, 1fr) auto auto;
            grid-template-areas:
                "collapse color identity identity identity"
                "count count count visibility actions";
            align-items: center;
            gap: 5px 8px;
            min-width: 0;
            min-height: 58px;
            padding: 6px 8px;
            background: var(--secondary-background-color, rgba(127, 127, 127, 0.06));
        }

        button,
        input,
        select {
            box-sizing: border-box;
            min-height: 34px;
            border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
            border-radius: 6px;
            background: var(--card-background-color, transparent);
            color: var(--primary-text-color);
            font: inherit;
        }

        button {
            cursor: pointer;
        }

        button:hover:not(:disabled) {
            border-color: var(--primary-color);
        }

        button:disabled {
            cursor: default;
            opacity: 0.35;
        }

        .collapse {
            grid-area: collapse;
            min-width: 34px;
            border: 0;
            background: transparent;
            font-size: 18px;
        }

        .color {
            grid-area: color;
            width: 38px;
            padding: 3px;
        }

        .identity {
            grid-area: identity;
            display: flex;
            min-width: 0;
            flex-direction: column;
            gap: 2px;
        }

        .name {
            width: 100%;
            padding: 6px 9px;
            font-weight: 600;
        }

        .depth {
            padding-left: 2px;
            color: var(--secondary-text-color);
            font-size: 10px;
        }

        .count {
            grid-area: count;
            min-width: 0;
            overflow: hidden;
            color: var(--secondary-text-color);
            font-size: 12px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .visibility {
            grid-area: visibility;
            display: flex;
            align-items: center;
            gap: 5px;
            color: var(--secondary-text-color);
            font-size: 12px;
            white-space: nowrap;
        }

        .visibility input {
            min-height: auto;
        }

        .folder-actions {
            grid-area: actions;
            display: flex;
            flex: 0 0 auto;
            flex-wrap: nowrap;
            justify-self: end;
            gap: 4px;
            min-width: max-content;
        }

        .folder-actions button {
            width: 30px;
            min-width: 30px;
            padding: 3px;
        }

        .add-folder {
            color: var(--primary-color);
            font-weight: 700;
        }

        .danger {
            color: var(--error-color, #db4437);
            font-size: 20px;
            line-height: 1;
        }

        .content {
            background: var(--card-background-color, var(--ha-card-background, #fff));
        }

        .empty {
            margin: 0;
            padding: 16px;
            color: var(--secondary-text-color);
            font-style: italic;
        }

        .folder-tools {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 12px;
            border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.24));
        }

        .add-element {
            display: flex;
            gap: 8px;
        }

        .add-element select,
        .add-element button,
        .secondary-action {
            padding: 5px 10px;
        }

        .primary {
            border-color: var(--primary-color);
            background: var(--primary-color);
            color: var(--text-primary-color, #fff);
            font-weight: 600;
        }

        .secondary-action {
            color: var(--primary-color);
            font-weight: 600;
        }

        .children {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 0 12px 12px 22px;
            border-left: 1px dashed var(--divider-color, rgba(127, 127, 127, 0.3));
        }

        @media (max-width: 860px) {
            .folder-tools,
            .add-element {
                align-items: stretch;
                flex-direction: column;
            }

            .children {
                padding-left: 10px;
            }
        }
    `;
		}
	}, X([L({ attribute: !1 })], Q.prototype, "layer", void 0), X([L({ type: Number })], Q.prototype, "index", void 0), X([L({ type: Number })], Q.prototype, "total", void 0), X([L({ type: Number })], Q.prototype, "depth", void 0), X([L({ attribute: !1 })], Q.prototype, "layerOptions", void 0), X([L({ attribute: !1 })], Q.prototype, "customCardOptions", void 0), X([L({ type: String })], Q.prototype, "language", void 0), X([R()], Q.prototype, "_newElementType", void 0), Q = X([I("lotus-layer-folder")], Q);
})), vt, yt, bt, xt = e((() => {
	$e(), H(), mt(), vt = "lotus-layers-card", yt = "https://demo.home-assistant.io/stub_config/floorplan.png", bt = class extends HTMLElement {
		_t(e, t = {}) {
			return B(z(this._hass), e, t);
		}
		_normalizationLabels() {
			return {
				unclassifiedName: this._t("defaults.unclassifiedElements"),
				folderName: (e) => this._t("defaults.folderNumber", { number: e })
			};
		}
		constructor() {
			super(), this._preview = !1, this._buildVersion = 0, this._handlePreviewClick = (e) => {
				if (!this._config || !this._nativeCard) return;
				let t = this._config[U];
				if (typeof t != "function") return;
				let n = this._nativeCard.getBoundingClientRect();
				if (n.width <= 0 || n.height <= 0) return;
				let r = (e.clientX - n.left) / n.width * 100, i = (e.clientY - n.top) / n.height * 100;
				if (r < 0 || r > 100 || i < 0 || i > 100) return;
				e.preventDefault();
				e.stopPropagation();
				t(Math.round(r), Math.round(i));
			}, this._root = this.attachShadow({ mode: "open" }), this._root.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                }

                #container {
                    display: block;
                    min-height: 1px;
                }

                .loading,
                .error {
                    box-sizing: border-box;
                    padding: 16px;
                    border-radius: var(--ha-card-border-radius, 12px);
                    background: var(--ha-card-background, var(--card-background-color, #fff));
                    color: var(--primary-text-color);
                }

                .error {
                    color: var(--error-color, #db4437);
                }
            </style>
            <div id="container" class="loading">${B(void 0, "card.loading")}</div>
        `, this._container = this._root.querySelector("#container"), this._container.addEventListener("click", this._handlePreviewClick, !0);
		}
		static getConfigElement() {
			return document.createElement("lotus-layers-editor");
		}
		static getStubConfig() {
			let e = z();
			return {
				title: B(e, "defaults.cardTitle"),
				image: yt,
				layers: [{
					id: "layer-default",
					name: B(e, "defaults.unclassifiedElements"),
					color: "#03a9f4",
					collapsed: !1,
					visible: !0,
					elements: []
				}]
			};
		}
		set hass(e) {
			this._hass = e, this._nativeCard ? this._nativeCard.hass = e : this._container.classList.contains("loading") && (this._container.textContent = this._t("card.loading"));
		}
		get hass() {
			return this._hass;
		}
		set preview(e) {
			this._preview = !!e, this._nativeCard && (this._nativeCard.preview = this._preview);
		}
		get preview() {
			return this._preview;
		}
		setConfig(e) {
			if (!e || typeof e != "object") throw Error(this._t("card.invalidConfig"));
			this._config = q(e, this._normalizationLabels()), this._renderNativeCard();
		}
		getCardSize() {
			return this._nativeCard?.getCardSize?.() ?? 4;
		}
		getGridOptions() {
			return this._nativeCard?.getGridOptions?.() ?? {
				columns: 12,
				min_columns: 3,
				rows: 6,
				min_rows: 3
			};
		}
		async _renderNativeCard() {
			if (!this._config) return;
			let e = ++this._buildVersion, t = dt(this._config);
			try {
				if (this._nativeCard) try {
					this._nativeCard.setConfig(t), this._nativeCard.hass = this._hass, this._nativeCard.preview = this._preview;
					return;
				} catch {
					this._nativeCard.remove(), this._nativeCard = void 0;
				}
				if (!window.loadCardHelpers) throw Error(this._t("card.helpersUnavailable"));
				this._showMessage(this._t("card.loadingPictureElements"), !1);
				let n = await window.loadCardHelpers();
				if (e !== this._buildVersion) return;
				let r = n.createCardElement(t);
				r.hass = this._hass, r.preview = this._preview, this._nativeCard = r, this._container.className = "", this._container.replaceChildren(r);
			} catch (e) {
				let t = e instanceof Error ? e.message : String(e);
				this._showMessage(`LotusLayers : ${t}`, !0);
			}
		}
		_showMessage(e, t) {
			this._container.className = t ? "error" : "loading", this._container.textContent = e;
		}
	}, customElements.get(vt) || customElements.define(vt, bt);
})), St, Ct, wt, $, Tt = e((() => {
	Re(), Xe(), $e(), H(), mt(), ot(), _t(), ht(), St = "https://demo.home-assistant.io/stub_config/floorplan.png", Ct = "M7,14H5V19H10V17H7V14M5,10H7V7H10V5H5V10M17,17H14V19H19V14H17V17M14,5V7H17V10H19V5H14Z", wt = "M14,14H19V16H16V19H14V14M5,14H10V19H8V16H5V14M8,5H10V10H5V8H8V5M19,8V10H14V5H16V8H19Z", $ = class extends F {
		constructor(...e) {
			super(...e), this._nativeEditorReady = !1, this._customCardOptions = [], this._customCardGuiMode = !0, this._customCardGuiAvailable = !0, this._dialogEnhancementFrame = 0, this._dialogEnhancementAttempts = 0, this._toggleDialogSize = (e) => {
				e.preventDefault(), e.stopPropagation();
				let t = this._editCardDialogHost;
				if (!t) return;
				let n = t.shadowRoot?.querySelector(".title-enlargeable");
				n ? n.click() : typeof t.large == "boolean" ? t.large = !t.large : t.toggleAttribute("large", !t.hasAttribute("large")), window.requestAnimationFrame(() => this._syncResizeButton());
			}, this._closeSubEditor = () => {
				this._subEditor = void 0, this._emitConfigChanged();
			}, this._handlePreviewClick = (e, t) => {
				if (!this._config || !this._subEditor) return;
				let n = W(this._config.layers ?? []), r = G(n, this._subEditor.layerId), i = r?.elements[this._subEditor.elementIndex];
				if (!r || !i || i.type === "conditional") return;
				let a = i.style?.position;
				if (typeof a == "string" && a !== "absolute") return;
				let o = {
					...i,
					style: {
						...i.style ?? {},
						left: `${Math.round(e)}%`,
						top: `${Math.round(t)}%`
					}
				};
				r.elements[this._subEditor.elementIndex] = o, this._config = {
					...this._config,
					layers: n
				}, this._subEditor = {
					...this._subEditor,
					config: {
						...this._subEditor.config,
						elementConfig: o
					}
				}, this._emitConfigChanged();
			};
		}
		get _language() {
			return z(this.hass);
		}
		_t(e, t = {}) {
			return B(this._language, e, t);
		}
		_normalizationLabels() {
			return {
				unclassifiedName: this._t("defaults.unclassifiedElements"),
				folderName: (e) => this._t("defaults.folderNumber", { number: e })
			};
		}
		connectedCallback() {
			super.connectedCallback(), this._refreshCustomCards(), this._customCardPoll = window.setInterval(() => this._refreshCustomCards(), 1500), this._loadNativePictureElementEditor(), this._scheduleDialogEnhancement();
		}
		disconnectedCallback() {
			this._customCardPoll && (window.clearInterval(this._customCardPoll), this._customCardPoll = void 0), this._dialogEnhancementFrame &&= (window.cancelAnimationFrame(this._dialogEnhancementFrame), 0), this._restoreDialogEnhancement(), super.disconnectedCallback();
		}
		_refreshCustomCards() {
			let e = lotusGetAvailableCustomCards(), t = JSON.stringify(e.map((e) => [e.type, e.name, e.hasVisualEditor]));
			if (t === this._customCardSignature) return;
			this._customCardSignature = t, this._customCardOptions = e;
		}
		setConfig(e) {
			let t = q(e, this._normalizationLabels());
			delete t[U], this._config = t;
		}
		updated() {
			this._scheduleDialogEnhancement(), this._syncResizeButton();
		}
		render() {
			if (!this._config) return k;
			if (this._subEditor) return this._renderSubEditor();
			let e = this._config.layers ?? [], t = nt(e), n = it(e), r = this._language, i = this._t(V(n, "editor.elementCount.one", "editor.elementCount.other"), { count: n }), a = this._t(V(t.length, "editor.folderCount.one", "editor.folderCount.other"), { count: t.length });
			return D`
            <div class="editor">
                <section class="panel options">
                    <h3>${this._t("editor.cardSettings")}</h3>

                    <div class="field-grid">
                        ${this._renderTextField("title", this._t("editor.title"), this._config.title)}
                        ${this._renderTextField("image", this._t("editor.backgroundImage"), typeof this._config.image == "string" ? this._config.image : void 0, "/local/plan-maison.png")}
                        ${this._renderTextField("dark_mode_image", this._t("editor.darkModeImage"), typeof this._config.dark_mode_image == "string" ? this._config.dark_mode_image : void 0, this._t("editor.optional"))}
                        ${this._renderTextField("camera_image", this._t("editor.cameraEntity"), this._config.camera_image, this._t("editor.cameraExample"))}
                        ${this._renderTextField("aspect_ratio", this._t("editor.aspectRatio"), this._config.aspect_ratio, "16:9")}
                        ${this._renderTextField("theme", this._t("editor.theme"), this._config.theme, this._t("editor.optional"))}

                        <label class="field">
                            <span>${this._t("editor.cameraView")}</span>
                            <select
                                data-field="camera_view"
                                .value=${this._config.camera_view ?? ""}
                                @change=${this._fieldChanged}
                            >
                                <option value="">${this._t("editor.defaultValue")}</option>
                                <option value="auto">${this._t("editor.automatic")}</option>
                                <option value="live">${this._t("editor.live")}</option>
                            </select>
                        </label>
                    </div>

                    <p class="helper">${this._t("editor.helper", { maxDepth: 5 })}</p>
                </section>

                <section class="layers-header">
                    <div>
                        <h3>${this._t("editor.elementTree")}</h3>
                        <p>${i} · ${a}</p>
                    </div>
                    <button type="button" class="primary" title=${this._t("editor.newRootFolder")} aria-label=${this._t("editor.newRootFolder")} @click=${this._addLayer}>
                        <ha-icon icon="mdi:folder-plus-outline"></ha-icon>
                    </button>
                </section>

                <div class="depth-notice">${this._t("editor.depthNotice", { maxDepth: 5 })}</div>

                <div class="layers">
                    ${e.map((n, i) => D`
                            <lotus-layer-folder
                                .layer=${n}
                                .index=${i}
                                .total=${e.length}
                                .depth=${1}
                                .layerOptions=${t}
                                .customCardOptions=${this._customCardOptions}
                                .language=${r}
                                @lotus-layer-changed=${this._layerChanged}
                                @lotus-layer-action=${this._layerAction}
                                @lotus-element-action=${this._elementAction}
                                @lotus-add-element=${this._addElement}
                            ></lotus-layer-folder>
                        `)}
                </div>

                ${this._nativeEditorError ? D`<p class="warning">${this._nativeEditorError}</p>` : k}
            </div>
        `;
		}
		_customCardPlacementChanged(e) {
			e.stopPropagation();
			if (!this._config || !this._subEditor) return;
			let t = e.currentTarget, n = t?.dataset?.styleKey, r = t?.dataset?.styleUnit ?? "";
			if (!n) return;
			let i = String(t.value ?? "").trim(), a = W(this._config.layers ?? []), o = G(a, this._subEditor.layerId), s = o?.elements[this._subEditor.elementIndex];
			if (!o || !s || s.type !== "custom:lotus-card-element") return;
			let l = { ...s.style ?? {} };
			if (!i) delete l[n];
			else {
				let e = Number(i);
				if (!Number.isFinite(e)) return;
				if (n === "left" || n === "top") e = Math.max(0, Math.min(100, e));
				if (n === "width" || n === "height") {
					e = r === "%" ? Math.max(0.1, Math.min(100, e)) : Math.max(1, Math.min(4000, e));
				}
				l[n] = `${e}${r}`;
			}
			(n === "left" || n === "top") && !l.transform && (l.transform = "translate(-50%, -50%)");
			if (lotusIsVisualStackCard(s.card)) {
				let e = lotusVisualStackGrid(s.card);
				delete l.height, l["aspect-ratio"] = e.ratio;
			}
			let c = { ...s, style: l };
			o.elements[this._subEditor.elementIndex] = c, this._config = { ...this._config, layers: a }, this._subEditor = {
				...this._subEditor,
				config: { ...this._subEditor.config, elementConfig: c }
			}, this._emitConfigChanged();
		}

		_customCardSizeModeChanged(e) {
			e.stopPropagation();
			if (!this._config || !this._subEditor) return;
			let mode = e.currentTarget?.value === "percent" ? "percent" : "px";
			let a = W(this._config.layers ?? []), o = G(a, this._subEditor.layerId), s = o?.elements[this._subEditor.elementIndex];
			if (!o || !s || s.type !== "custom:lotus-card-element") return;

			let l = { ...s.style ?? {} }, isVsc = lotusIsVisualStackCard(s.card);
			if (isVsc) {
				let grid = lotusVisualStackGrid(s.card);
				if (mode === "percent") {
					let current = Number.parseFloat(String(l.width ?? ""));
					l.width = String(l.width ?? "").endsWith("%") && Number.isFinite(current) ? `${Math.max(.1, Math.min(100, current))}%` : "20%";
				} else l.width = `${grid.widthPx}px`;
				delete l.height, l["aspect-ratio"] = grid.ratio;
			} else {
				let widthText = String(l.width ?? ""), heightText = String(l.height ?? "");
				let widthNumber = Number.parseFloat(widthText), heightNumber = Number.parseFloat(heightText);
				if (mode === "percent") {
					if (!widthText.endsWith("%")) {
						widthNumber = Number.isFinite(widthNumber) && widthNumber <= 100 ? widthNumber : 20;
						l.width = `${Math.max(.1, Math.min(100, widthNumber))}%`;
					}
					if (heightText && !heightText.endsWith("%")) {
						heightNumber = Number.isFinite(heightNumber) && heightNumber <= 100 ? heightNumber : 20;
						l.height = `${Math.max(.1, Math.min(100, heightNumber))}%`;
					}
				} else {
					if (!widthText.endsWith("px")) l.width = "320px";
					if (heightText && !heightText.endsWith("px")) l.height = "240px";
				}
			}

			let c = { ...s, style: l };
			o.elements[this._subEditor.elementIndex] = c, this._config = { ...this._config, layers: a }, this._subEditor = {
				...this._subEditor,
				config: { ...this._subEditor.config, elementConfig: c }
			}, this._emitConfigChanged(), this.requestUpdate();
		}

		_renderSubEditor() {
			if (!this._subEditor || !this._config) return k;
			let e = G(this._config.layers, this._subEditor.layerId), t = e?.elements[this._subEditor.elementIndex], n = t?.type === "custom:lotus-card-element" && t.card, r = t?.style ?? {}, i = (e, t = "") => {
				let n = Number.parseFloat(String(r?.[e] ?? ""));
				return Number.isFinite(n) ? n : t;
			}, a = String(r?.width ?? "320px").trim().endsWith("%") ? "percent" : "px", o = a === "percent" ? "%" : "px", s = lotusIsVisualStackCard(n), l = s ? lotusVisualStackGrid(n) : void 0;
			return D`
            <div class="sub-editor">
                <div class="sub-header">
                    <button type="button" title=${this._t("editor.back")} aria-label=${this._t("editor.back")} @click=${this._closeSubEditor}><ha-icon icon="mdi:arrow-left"></ha-icon></button>
                    <div>
                        <strong>${n ? s ? "Lotus Stack" : lotusGetCustomCardInfo(t.card.type)?.name ?? t.card.type : this._t("editor.editElement")}</strong>
                        <span>${e?.name ?? this._t("editor.unknownFolder")}</span>
                    </div>
                    ${n ? D`
                            <button
                                type="button"
                                class="editor-mode-button"
                                ?disabled=${!this._customCardGuiAvailable}
                                @click=${this._toggleCustomCardEditorMode}
                             title=${this._customCardGuiMode ? this._t("editor.showYamlEditor") : this._t("editor.showVisualEditor")} aria-label=${this._customCardGuiMode ? this._t("editor.showYamlEditor") : this._t("editor.showVisualEditor")}><ha-icon icon=${this._customCardGuiMode ? "mdi:code-braces" : "mdi:form-select"}></ha-icon></button>
                        ` : k}
                </div>

                <p class="position-hint">${this._t("editor.positionHint")}</p>

                ${n ? D`
                        <section class="panel custom-card-placement">
                            <h3>${this._t("editor.positionAndSize")}</h3>
                            <div class="field-grid">
                                <label class="field">
                                    <span>${this._t("editor.positionX")}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        .value=${String(i("left", 50))}
                                        data-style-key="left"
                                        data-style-unit="%"
                                        @change=${this._customCardPlacementChanged}
                                    />
                                </label>
                                <label class="field">
                                    <span>${this._t("editor.positionY")}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        .value=${String(i("top", 50))}
                                        data-style-key="top"
                                        data-style-unit="%"
                                        @change=${this._customCardPlacementChanged}
                                    />
                                </label>
                                <label class="field">
                                    <span>${this._t("editor.sizeMode")}</span>
                                    <select
                                        .value=${a}
                                        @change=${this._customCardSizeModeChanged}
                                    >
                                        <option value="px">${this._t("editor.pixels")}</option>
                                        <option value="percent">${this._t("editor.responsivePlan")}</option>
                                    </select>
                                </label>
                                <div></div>
                                <label class="field">
                                    <span>${this._t("editor.widthWithUnit", { unit:o })}</span>
                                    <input
                                        type="number"
                                        min=${a === "percent" ? "0.1" : "1"}
                                        max=${a === "percent" ? "100" : "4000"}
                                        step=${a === "percent" ? "0.1" : "1"}
                                        .value=${String(i("width", a === "percent" ? 20 : s ? l.widthPx : 320))}
                                        data-style-key="width"
                                        data-style-unit=${o}
                                        @change=${this._customCardPlacementChanged}
                                    />
                                </label>
                                ${s ? D`
                                    <div class="field">
                                        <span>${this._t("editor.autoProportions")}</span>
                                        <div class="ratio-readout">
                                            ${this._t("editor.gridDimensions", { columns:l.columns, rows:l.rows, ratio:`${l.columns}:${l.rows}` })}
                                            <br />
                                            ${this._t("editor.defaultPixelSize", { width:l.widthPx, height:l.heightPx })}
                                        </div>
                                    </div>
                                ` : D`
                                    <label class="field">
                                        <span>${this._t("editor.heightWithUnit", { unit:o })}</span>
                                        <input
                                            type="number"
                                            min=${a === "percent" ? "0.1" : "1"}
                                            max=${a === "percent" ? "100" : "4000"}
                                            step=${a === "percent" ? "0.1" : "1"}
                                            placeholder=${this._t("editor.automatic")}
                                            .value=${String(i("height", ""))}
                                            data-style-key="height"
                                            data-style-unit=${o}
                                            @change=${this._customCardPlacementChanged}
                                        />
                                    </label>
                                `}
                            </div>
                            <p class="helper">
                                ${this._t(s ? "editor.visualStackSizeHelp" : "editor.responsiveSizeHelp")}
                            </p>
                        </section>

                        <hui-card-element-editor
                            id="lotus-custom-card-editor"
                            .hass=${this.hass}
                            .lovelace=${this.lovelace}
                            .value=${t.card}
                            .inDialog=${!0}
                            .GUImode=${this._customCardGuiMode}
                            @config-changed=${this._customCardChanged}
                            @GUImode-changed=${this._customCardGuiModeChanged}
                        ></hui-card-element-editor>
                    ` : this._nativeEditorReady ? D`
                        <hui-sub-element-editor
                            .hass=${this.hass}
                            .config=${this._subEditor.config}
                            @config-changed=${this._subElementChanged}
                            @go-back=${this._closeSubEditor}
                        ></hui-sub-element-editor>
                    ` : D`
                        <div class="loading-editor">
                            ${this._t("editor.loadingNativeEditor")}
                        </div>
                    `}
            </div>
        `;
		}
		_toggleCustomCardEditorMode() {
			let e = this.renderRoot?.querySelector("#lotus-custom-card-editor");
			if (!e || !this._customCardGuiAvailable) return;
			this._customCardGuiMode = !this._customCardGuiMode;
			e.GUImode = this._customCardGuiMode;
			this.requestUpdate();
			this.updateComplete?.then?.(() => {
				if (!this._customCardGuiMode) {
					this.renderRoot?.querySelector("#lotus-custom-card-editor")?.focusYamlEditor?.();
				}
			});
		}
		_customCardGuiModeChanged(e) {
			e.stopPropagation();
			let t = e.detail?.guiMode !== !1, n = e.detail?.guiModeAvailable !== !1;
			this._customCardGuiAvailable = n;
			if (this._customCardGuiMode !== t) {
				this._customCardGuiMode = t;
				this.requestUpdate();
			}
		}
		_customCardChanged(e) {
			e.stopPropagation();
			if (!this._config || !this._subEditor || !e.detail?.config) return;
			let t = W(this._config.layers ?? []), n = G(t, this._subEditor.layerId), r = n?.elements[this._subEditor.elementIndex];
			if (!n || !r || r.type !== "custom:lotus-card-element") return;
			let newCard = ft(e.detail.config), newStyle = { ...r.style ?? {} };
			if (lotusIsVisualStackCard(newCard)) {
				let oldGrid = lotusVisualStackGrid(r.card), newGrid = lotusVisualStackGrid(newCard), widthText = String(newStyle.width ?? ""), widthNumber = Number.parseFloat(widthText);
				newStyle["aspect-ratio"] = newGrid.ratio, delete newStyle.height;
				if (!widthText || widthText.endsWith("px") && (!Number.isFinite(widthNumber) || Math.abs(widthNumber - oldGrid.widthPx) < .01)) newStyle.width = `${newGrid.widthPx}px`;
			}
			let i = {
				...r,
				card: newCard,
				style: newStyle
			};
			n.elements[this._subEditor.elementIndex] = i, this._config = {
				...this._config,
				layers: t
			}, this._subEditor = {
				...this._subEditor,
				config: {
					...this._subEditor.config,
					elementConfig: i
				}
			}, this._emitConfigChanged();
		}
		_scheduleDialogEnhancement() {
			!this.isConnected || this._dialogEnhancementFrame || (this._dialogEnhancementFrame = window.requestAnimationFrame(() => {
				this._dialogEnhancementFrame = 0, !this._enhanceParentDialog() && (this._dialogEnhancementAttempts += 1, this._dialogEnhancementAttempts < 60 && this._scheduleDialogEnhancement());
			}));
		}
		_enhanceParentDialog() {
			let e = this._findComposedAncestor("ha-dialog"), t = this._findComposedAncestor("hui-dialog-edit-card");
			if (!e || !t) return !1;
			(this._dialogHost && this._dialogHost !== e || this._editCardDialogHost && this._editCardDialogHost !== t) && this._restoreDialogEnhancement(), this._dialogHost = e, this._editCardDialogHost = t;
			let n = e.shadowRoot, r = t.shadowRoot;
			if (!n || !r) return !1;
			if (!this._dialogStyleElement) {
				let e = document.createElement("style");
				e.dataset.lotusLayersResizableDialog = "", e.textContent = "\n                @media (min-width: 760px) and (min-height: 560px) {\n                    :host {\n                        --ha-dialog-max-width: calc(100vw - 16px);\n                        --ha-dialog-max-height: calc(100vh - 16px);\n                        --ha-dialog-width-full: calc(100vw - 16px);\n                        --mdc-dialog-max-width: calc(100vw - 16px);\n                        --mdc-dialog-max-height: calc(100vh - 16px);\n                    }\n\n                    wa-dialog::part(dialog),\n                    mwc-dialog::part(surface),\n                    .mdc-dialog__surface {\n                        box-sizing: border-box !important;\n                        resize: both !important;\n                        overflow: hidden !important;\n                        min-width: min(760px, calc(100vw - 16px)) !important;\n                        min-height: min(520px, calc(100vh - 16px)) !important;\n                        max-width: calc(100vw - 16px) !important;\n                        max-height: calc(100vh - 16px) !important;\n                    }\n                }\n            ", n.append(e), this._dialogStyleElement = e;
			}
			if (!this._editCardDialogStyleElement) {
				let e = document.createElement("style");
				e.dataset.lotusLayersEditorLayout = "", e.textContent = "\n                @media all and (min-width: 1000px) {\n                    .content > .element-editor {\n                        flex: 1 1 auto !important;\n                        max-width: none !important;\n                    }\n\n                    .content > .element-preview {\n                        flex: 0 1 clamp(320px, 35%, 560px) !important;\n                        width: clamp(320px, 35%, 560px) !important;\n                        min-width: 320px !important;\n                        max-width: 560px !important;\n                    }\n                }\n\n                ha-dialog ha-icon-button[data-lotus-layers-resize-button] {\n                    color: var(--secondary-text-color);\n                }\n            ", r.append(e), this._editCardDialogStyleElement = e;
			}
			return this._ensureResizeButton(e, t), !0;
		}
		_ensureResizeButton(e, t) {
			if (!this._resizeButton?.isConnected) {
				let t = e.querySelector("ha-icon-button[data-lotus-layers-resize-button]");
				if (t) this._resizeButton = t;
				else {
					let t = document.createElement("ha-icon-button");
					t.slot = "headerActionItems", t.dataset.lotusLayersResizeButton = "", t.addEventListener("click", this._toggleDialogSize), e.append(t), this._resizeButton = t;
				}
			}
			this._dialogLargeObserver || (this._dialogLargeObserver = new MutationObserver(() => {
				this._syncResizeButton();
			}), this._dialogLargeObserver.observe(t, {
				attributes: !0,
				attributeFilter: ["large"]
			})), this._syncResizeButton();
		}
		_syncResizeButton() {
			if (!this._resizeButton || !this._editCardDialogHost) return;
			let e = this._editCardDialogHost.hasAttribute("large") || this._editCardDialogHost.large === !0;
			this._resizeButton.path = e ? wt : Ct, this._resizeButton.label = e ? this._t("editor.restoreWindow") : this._t("editor.enlargeWindow"), this._resizeButton.selected = e, this._resizeButton.setAttribute("aria-label", this._resizeButton.label), this._resizeButton.setAttribute("title", this._resizeButton.label);
		}
		_findComposedAncestor(e) {
			let t = this;
			for (; t;) {
				if (t instanceof HTMLElement && t.localName === e) return t;
				if (t.parentNode) {
					t = t.parentNode;
					continue;
				}
				let n = t.getRootNode();
				t = n instanceof ShadowRoot ? n.host : null;
			}
		}
		_restoreDialogEnhancement() {
			this._dialogLargeObserver?.disconnect(), this._dialogLargeObserver = void 0, this._resizeButton && (this._resizeButton.removeEventListener("click", this._toggleDialogSize), this._resizeButton.remove()), this._resizeButton = void 0, this._editCardDialogStyleElement?.remove(), this._editCardDialogStyleElement = void 0, this._editCardDialogHost = void 0, this._dialogStyleElement?.remove(), this._dialogStyleElement = void 0, this._dialogHost = void 0, this._dialogEnhancementAttempts = 0;
		}
		_renderTextField(e, t, n, r = "") {
			return D`
            <label class="field">
                <span>${t}</span>
                <input
                    type="text"
                    data-field=${String(e)}
                    .value=${typeof n == "string" ? n : ""}
                    placeholder=${r}
                    @input=${this._fieldChanged}
                />
            </label>
        `;
		}
		async _loadNativePictureElementEditor() {
			try {
				if (!window.loadCardHelpers) throw Error(this._t("editor.helpersUnavailable"));
				let e = (await window.loadCardHelpers()).createCardElement({
					type: "picture-elements",
					image: St,
					elements: []
				}).constructor;
				if (typeof e.getConfigElement == "function" && await e.getConfigElement(), this._nativeEditorReady = customElements.get("hui-sub-element-editor") !== void 0, !this._nativeEditorReady) throw Error(this._t("editor.nativeEditorUnavailable"));
			} catch (e) {
				this._nativeEditorError = e instanceof Error ? e.message : String(e);
			}
		}
		_fieldChanged(e) {
			if (!this._config) return;
			let t = e.currentTarget, n = t.dataset.field;
			if (!n) return;
			let r = { ...this._config }, i = t.value.trim();
			i ? r[n] = i : delete r[n], this._commit(r);
		}
		_addLayer() {
			if (!this._config) return;
			let e = W(this._config.layers ?? []);
			e.push(K(this._t("defaults.folderNumber", { number: e.length + 1 }))), this._commit({
				...this._config,
				layers: e
			});
		}
		_layerChanged(e) {
			if (e.stopPropagation(), !this._config) return;
			let t = W(this._config.layers ?? []);
			tt(t, e.detail) && this._commit({
				...this._config,
				layers: t
			});
		}
		_layerAction(e) {
			if (e.stopPropagation(), !this._config) return;
			let t = W(this._config.layers ?? []), n = et(t, e.detail.layerId);
			if (!n) return;
			let { layer: r, siblings: i, index: a, parent: o, depth: s } = n;
			switch (e.detail.action) {
				case "move-up":
					a > 0 && ([i[a - 1], i[a]] = [i[a], i[a - 1]]);
					break;
				case "move-down":
					a < i.length - 1 && ([i[a + 1], i[a]] = [i[a], i[a + 1]]);
					break;
				case "add-child":
					if (s >= 5) return;
					r.children = [...r.children ?? []], r.children.push(K(this._t("defaults.subfolderNumber", { number: r.children.length + 1 }))), r.collapsed = !1;
					break;
				case "delete": {
					let [e] = i.splice(a, 1), n = e.children ?? [];
					if (n.length > 0 && i.splice(a, 0, ...n), e.elements.length > 0) if (o) o.elements.push(...e.elements);
					else {
						let t = n[0] ?? i[a] ?? i[a - 1];
						t ? t.elements.push(...e.elements) : i.push(K(this._t("defaults.unclassifiedElements"), e.elements));
					}
					t.length === 0 && t.push(K(this._t("defaults.unclassifiedElements")));
					break;
				}
			}
			this._commit({
				...this._config,
				layers: t
			});
		}
		_elementAction(e) {
			if (e.stopPropagation(), !this._config) return;
			let t = G(this._config.layers, e.detail.layerId), n = t?.elements[e.detail.elementIndex];
			if (!t || !n) return;
			if (e.detail.action === "edit") {
				this._openSubEditor(t.id, e.detail.elementIndex, n);
				return;
			}
			let r = W(this._config.layers ?? []), i = G(r, e.detail.layerId);
			if (!i) return;
			let a = e.detail.elementIndex, o = i.elements[a];
			if (o) {
				switch (e.detail.action) {
					case "duplicate":
						i.elements.splice(a + 1, 0, ft(o));
						break;
					case "delete":
						i.elements.splice(a, 1);
						break;
					case "move-up":
						a > 0 && ([i.elements[a - 1], i.elements[a]] = [i.elements[a], i.elements[a - 1]]);
						break;
					case "move-down":
						a < i.elements.length - 1 && ([i.elements[a + 1], i.elements[a]] = [i.elements[a], i.elements[a + 1]]);
						break;
					case "move-to-layer": {
						let t = e.detail.targetLayerId ? G(r, e.detail.targetLayerId) : void 0;
						t && t.id !== i.id && (i.elements.splice(a, 1), t.elements.push(o));
						break;
					}
				}
				this._commit({
					...this._config,
					layers: r
				});
			}
		}
		async _addElement(e) {
			if (e.stopPropagation(), !this._config) return;
			let t = lotusParseCustomCardSelection(e.detail.elementType);
			if (t && !lotusGetCustomCardInfo(t)) {
				this._nativeEditorError = this._t("editor.customCardUnavailable");
				return;
			}
			let n = W(this._config.layers ?? []), r = G(n, e.detail.layerId);
			if (!r) return;
			let i = await this._createElementStub(e.detail.elementType);
			if (!i) return;
			let a = r.elements.push(i) - 1, o = {
				...this._config,
				layers: n
			};
			this._nativeEditorError = void 0, this._config = o, this._customCardGuiMode = !0, this._customCardGuiAvailable = !0, this._openSubEditor(r.id, a, i, !1), this._emitConfigChanged();
		}
		async _createElementStub(e) {
			let t = this._findDefaultEntity(), n = {
				left: "50%",
				top: "50%"
			}, r = lotusParseCustomCardSelection(e);
			if (r) {
				let e = lotusGetCustomCardInfo(r);
				if (!e) return;
				let i = { type: r }, a = Object.keys(this.hass?.states ?? {});
				if (typeof e.constructor?.getStubConfig == "function") try {
					let t = await e.constructor.getStubConfig(this.hass, a, []);
					t && typeof t == "object" && (i = {
						...ft(t),
						type: r
					});
				} catch {}
				if ((r === "custom:lotus-visual-stack" || r === "custom:visual-stack-card") && window.LotusVisualStack?.toNative && window.LotusVisualStack?.toInternal) try {
					i = window.LotusVisualStack.toNative(window.LotusVisualStack.toInternal(i), this.hass);
				} catch {}
				let size = lotusIsVisualStackCard(i) ? lotusVisualStackGrid(i) : void 0;
				return {
					type: "custom:lotus-card-element",
					card: i,
					style: {
						...n,
						width: size ? `${size.widthPx}px` : "320px",
						...(size ? { "aspect-ratio": size.ratio } : {}),
						transform: "translate(-50%, -50%)"
					}
				};
			}
			switch (e) {
				case "state-badge":
				case "state-icon":
				case "state-label": return {
					type: e,
					entity: t,
					style: n
				};
				case "action-button": return {
					type: e,
					title: this._t("defaults.newAction"),
					style: n,
					tap_action: { action: "none" }
				};
				case "icon": return {
					type: e,
					icon: "mdi:lightbulb-outline",
					title: this._t("defaults.newIcon"),
					style: n,
					tap_action: { action: "none" }
				};
				case "image": return {
					type: e,
					image: "/local/image.png",
					style: n
				};
				case "conditional": return {
					type: e,
					conditions: [],
					elements: []
				};
				default: return {
					type: e,
					style: n
				};
			}
		}
		_findDefaultEntity() {
			let e = Object.keys(this.hass?.states ?? {});
			return e.includes("sun.sun") ? "sun.sun" : e[0] ?? "";
		}
		_openSubEditor(e, t, n, r = !0) {
			n?.type === "custom:lotus-card-element" && (this._customCardGuiMode = !0, this._customCardGuiAvailable = !0), this._subEditor = {
				layerId: e,
				elementIndex: t,
				config: {
					index: t,
					type: "element",
					elementConfig: ft(n)
				}
			}, r && this._emitConfigChanged();
		}
		_subElementChanged(e) {
			if (e.stopPropagation(), !this._config || !this._subEditor) return;
			let t = W(this._config.layers ?? []), n = G(t, this._subEditor.layerId);
			if (!n) return;
			let r = e.detail.config;
			if (!r) {
				n.elements.splice(this._subEditor.elementIndex, 1), this._config = {
					...this._config,
					layers: t
				}, this._subEditor = void 0, this._emitConfigChanged();
				return;
			}
			n.elements[this._subEditor.elementIndex] = r, this._config = {
				...this._config,
				layers: t
			}, this._subEditor = {
				...this._subEditor,
				config: {
					...this._subEditor.config,
					elementConfig: r
				}
			}, this._emitConfigChanged();
		}
		_commit(e) {
			this._config = q(e, this._normalizationLabels()), delete this._config[U], this._emitConfigChanged();
		}
		_emitConfigChanged() {
			if (!this._config) return;
			let e = this._subEditor ? {
				...this._config,
				[U]: this._handlePreviewClick
			} : { ...this._config };
			this.dispatchEvent(new CustomEvent("config-changed", {
				detail: { config: e },
				bubbles: !0,
				composed: !0
			}));
		}
		static {
			this.styles = c`
        :host {
            display: block;
            box-sizing: border-box;
            min-height: 0;
            height: 100%;
            color: var(--primary-text-color);
        }

        .editor,
        .sub-editor {
            display: flex;
            box-sizing: border-box;
            flex-direction: column;
            gap: 16px;
            min-height: 0;
            height: 100%;
            overflow: auto;
            scrollbar-gutter: stable;
        }

        .panel {
            padding: 16px;
            border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
            border-radius: 10px;
            background: var(--card-background-color, var(--ha-card-background, #fff));
        }

        h3,
        p {
            margin: 0;
        }

        h3 {
            font-size: 16px;
        }

        .field-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-top: 14px;
        }

        .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
        }

        .field span {
            color: var(--secondary-text-color);
            font-size: 12px;
            font-weight: 600;
        }

        input,
        select,
        button {
            box-sizing: border-box;
            min-height: 38px;
            border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
            border-radius: 7px;
            background: var(--card-background-color, transparent);
            color: var(--primary-text-color);
            font: inherit;
        }

        input,
        select {
            width: 100%;
            padding: 7px 10px;
        }

        button {
            padding: 7px 12px;
            cursor: pointer;
        }

        button:hover {
            border-color: var(--primary-color);
        }

        .helper,
        .layers-header p,
        .position-hint,
        .warning,
        .depth-notice {
            color: var(--secondary-text-color);
            font-size: 13px;
            line-height: 1.45;
        }

        .helper {
            margin-top: 14px;
        }

        .layers-header,
        .sub-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .sub-header > div {
            flex: 1 1 auto;
            min-width: 0;
        }

        .editor-mode-button {
            flex: 0 0 auto;
            color: var(--primary-color);
            font-weight: 600;
        }

        .layers-header > div,
        .sub-header > div {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .primary {
            border-color: var(--primary-color);
            background: var(--primary-color);
            color: var(--text-primary-color, #fff);
            font-weight: 600;
        }

        .depth-notice {
            padding: 10px 12px;
            border-left: 4px solid var(--primary-color);
            background: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
        }

        .layers {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .sub-editor {
            padding-bottom: 12px;
        }

        .sub-header {
            padding-bottom: 12px;
            border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
        }

        .sub-header span {
            color: var(--secondary-text-color);
            font-size: 12px;
        }

        .position-hint {
            padding: 10px 12px;
            border-left: 4px solid var(--primary-color);
            background: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
        }

        .loading-editor,
        .warning {
            padding: 14px;
            border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
            border-radius: 8px;
        }

        .warning {
            color: var(--warning-color, #f5a623);
        }

        @media (max-width: 720px) {
            .field-grid {
                grid-template-columns: 1fr;
            }

            .layers-header {
                align-items: stretch;
                flex-direction: column;
            }
        }
    `;
		}
	}, X([L({ attribute: !1 })], $.prototype, "hass", void 0), X([L({ attribute: !1 })], $.prototype, "lovelace", void 0), X([R()], $.prototype, "_config", void 0), X([R()], $.prototype, "_subEditor", void 0), X([R()], $.prototype, "_nativeEditorReady", void 0), X([R()], $.prototype, "_nativeEditorError", void 0), X([R()], $.prototype, "_customCardOptions", void 0), X([R()], $.prototype, "_customCardGuiMode", void 0), X([R()], $.prototype, "_customCardGuiAvailable", void 0), $ = X([I("lotus-layers-editor")], $);
})), Et = /* @__PURE__ */ t((() => {
	_t(), gt(), xt(), Tt(), H();
	var e = "lotus-layers-card", t = "0.8.1";
	window.customCards = window.customCards ?? [];
	var n = z();
	if (!window.customCards.some((t) => t.type === e)) {
		let t = {
			type: e,
			name: "LotusLayers",
			description: B(n, "metadata.description"),
			preview: !0
		};
		window.customCards.push(t);
	}
}));
//#endregion
export default Et();
