import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import '../src/optimize-tsx';
import { html, render } from '../src/template';
import { Injector } from '@deepkit/injector';
import { simple1, simple2, simple3, simple4, simpleHtmlInjected, simpleHtmlInjectedValid } from './simple';
import { convertJsxCodeToCreateElement, optimizeJSX } from '../src/optimize-tsx';

test('template simple', async () => {
    expect(await render(new Injector(), <div></div>)).toBe('<div></div>');

    expect(await render(new Injector(), <div>Test</div>)).toBe('<div>Test</div>');
    expect(await render(new Injector(), <div id="12"></div>)).toBe(`<div id="12"></div>`);
    expect(await render(new Injector(), <div id="12">Test</div>)).toBe(`<div id="12">Test</div>`);

    expect(await render(new Injector(), <div><a href="google.de">Link</a></div>)).toBe('<div><a href="google.de">Link</a></div>');

    expect(await render(new Injector(), <div><b>Link2</b><strong>Link2</strong></div>)).toBe('<div><b>Link2</b><strong>Link2</strong></div>');
});

test('template html escape', async () => {
    expect(await render(new Injector(), <div>{'<strong>MyHTML</strong>'}</div>)).toBe('<div>&lt;strong&gt;MyHTML&lt;/strong&gt;</div>');

    const myVar = '<strong>MyHTML</strong>';
    expect(await render(new Injector(), <div>{myVar}</div>)).toBe('<div>&lt;strong&gt;MyHTML&lt;/strong&gt;</div>');

    expect(await render(new Injector(), <div>{html(myVar)}</div>)).toBe('<div><strong>MyHTML</strong></div>');

    expect(await render(new Injector(), <div id={myVar}></div>)).toBe('<div id="&lt;strong&gt;MyHTML&lt;/strong&gt;"></div>');
});

function normalize(string: string): string {
    return string.trim().replace(/\n\s*/g, '');
}

// function test1(props: {[name: string]: any} = {}) {
//     return <div {...props} id="123">Test</div>
// }

// import tree from 'abstract-syntax-tree';
//
// test('template test', async () => {
//     // console.log(test1.toString());
//     // console.log(JSON.stringify(tree.parse('_jsx.createElement("div", {}, void 0)')));
// });


test('template jsx for esm convert to createElement', async () => {
    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { id: "123" }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: "123"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { id: myId }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: myId});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: "123",name: "Peter"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", { children: "Test" }, void 0);`))).toBe(
        `_jsx.createElement("div", {}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `_jsx.createElement("div", {id: "123"}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(
        `_jsxs("div", Object.assign({ id: "123" }, { children: [_jsx("b", { children: "strong" }, void 0), _jsx("b", { children: "strong2" }, void 0)] }), void 0);`
    ))).toBe(
        `_jsx.createElement("div", {id: "123"}, _jsx.createElement("b", {}, "strong"), _jsx.createElement("b", {}, "strong2"));`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `_jsx.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`_jsx('div', {children: this.config.get('TEST') }, void 0);`))).toBe(
        `_jsx.createElement("div", {}, this.config.get("TEST"));`
    );
});

test('template jsx for esm optimize', async () => {
    expect(normalize(optimizeJSX(`_jsx("div", { id: "123" }, void 0);`))).toBe(
        `_jsx.html("<div id=\\"123\\"></div>");`
    );

    expect(normalize(optimizeJSX(`_jsx("div", { id: myId }, void 0);`))).toBe(
        `_jsx.createElement("div", {id: myId});`
    );

    expect(normalize(optimizeJSX(`_jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `_jsx.html("<div id=\\"123\\" name=\\"Peter\\"></div>");`
    );

    expect(normalize(optimizeJSX(`_jsx("div", { children: "Test" }, void 0);`))).toBe(
        `_jsx.html("<div>Test</div>");`
    );

    expect(normalize(optimizeJSX(`_jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `_jsx.html("<div id=\\"123\\">Test</div>");`
    );

    expect(normalize(optimizeJSX(`_jsx("div", Object.assign({}, props, { id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `_jsx.createElement("div", Object.assign({}, props, {id: "123"}), "Test");`
    );

    expect(normalize(optimizeJSX(`_jsxs("div", Object.assign({ id: "123" }, { children: [_jsx("b", { children: "strong" }, void 0), _jsx("b", { children: "strong2" }, void 0)] }), void 0);`))).toBe(
        `_jsx.html("<div id=\\"123\\"><b>strong</b><b>strong2</b></div>");`
    );

    expect(normalize(optimizeJSX(`_jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `_jsx.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(optimizeJSX(`_jsx(Website, { title: "Contact", children: _jsx("div", { id: "123" }, void 0)}, void 0);`))).toBe(
        `_jsx.createElement(Website, {title: "Contact"}, _jsx.html("<div id=\\"123\\"></div>"));`
    );
});


test('template jsx for cjs convert to createElement', async () => {
    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: "123" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: myId }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: myId});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123",name: "Peter"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", { children: "Test" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"}, "Test");`
    );

    expect(normalize(convertJsxCodeToCreateElement(
        `jsx_runtime_1.jsxs("div", Object.assign({ id: "123" }, { children: [jsx_runtime_1.jsx("b", { children: "strong" }, void 0), jsx_runtime_1.jsx("b", { children: "strong2" }, void 0)] }), void 0);`
    ))).toBe(
        `jsx_runtime_1.createElement("div", {id: "123"}, jsx_runtime_1.createElement("b", {}, "strong"), jsx_runtime_1.createElement("b", {}, "strong2"));`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(convertJsxCodeToCreateElement(`jsx_runtime_1.jsx('div', {children: this.config.get('TEST') }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {}, this.config.get("TEST"));`
    );
});

test('template jsx for cjs optimize', async () => {
    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { id: "123" }, void 0);`))).toBe(
        `jsx_runtime_1.html("<div id=\\"123\\"></div>");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { id: myId }, void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", {id: myId});`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { id: "123", name: "Peter" }, void 0);`))).toBe(
        `jsx_runtime_1.html("<div id=\\"123\\" name=\\"Peter\\"></div>");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", { children: "Test" }, void 0);`))).toBe(
        `jsx_runtime_1.html("<div>Test</div>");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", Object.assign({ id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `jsx_runtime_1.html("<div id=\\"123\\">Test</div>");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx("div", Object.assign({}, props, { id: "123" }, { children: "Test" }), void 0);`))).toBe(
        `jsx_runtime_1.createElement("div", Object.assign({}, props, {id: "123"}), "Test");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsxs("div", Object.assign({ id: "123" }, { children: [jsx_runtime_1.jsx("b", { children: "strong" }, void 0), jsx_runtime_1.jsx("b", { children: "strong2" }, void 0)] }), void 0);`))).toBe(
        `jsx_runtime_1.html("<div id=\\"123\\"><b>strong</b><b>strong2</b></div>");`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx(Website, { title: "Contact" }, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"});`
    );

    expect(normalize(optimizeJSX(`jsx_runtime_1.jsx(Website, { title: "Contact", children: jsx_runtime_1.jsx("div", { id: "123" }, void 0)}, void 0);`))).toBe(
        `jsx_runtime_1.createElement(Website, {title: "Contact"}, jsx_runtime_1.html("<div id=\\"123\\"></div>"));`
    );
});

test('template simple import', async () => {
    expect(await render(new Injector(), simple1())).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), simple2())).toBe('<div id="123"><b>strong</b></div>');
    expect(await render(new Injector(), simple3())).toBe('<div id="123"><b>strong</b><b>strong2</b></div>');
    expect(await render(new Injector(), simple4())).toBe('<div id="123" class="active"><div><b>strong</b><b>strong2</b></div></div>');
    expect(await render(new Injector(), simpleHtmlInjected())).toBe('<div>&lt;strong&gt;MyHTML&lt;/strong&gt;</div>');
    expect(await render(new Injector(), simpleHtmlInjectedValid())).toBe('<div><strong>MyHTML</strong></div>');
});

test('template render custom', async () => {
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: 'Test' })).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: '<b>Test</b>' })).toBe('<div id="123">&lt;b&gt;Test&lt;/b&gt;</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: html('Test') })).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: [html('Test')] })).toBe('<div id="123">Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: [html('<b>Test</b>')] })).toBe('<div id="123"><b>Test</b></div>');

    expect(await render(new Injector(), { render: 'div', attributes: { id: '123' }, children: ["Hi ", html('Test')] })).toBe('<div id="123">Hi Test</div>');
    expect(await render(new Injector(), { render: 'div', attributes: "", children: ["Hi ", html('Test')] })).toBe('<div>Hi Test</div>');

    expect(await render(new Injector(), { render: 'div', attributes: "", children: ["Hi ", { render: 'div', attributes: "", children: html('Test') }] })).toBe('<div>Hi <div>Test</div></div>');

});
