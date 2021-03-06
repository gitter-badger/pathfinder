/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Loader } = require('sdk/test/loader');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { open, close, focus, promise: windowPromise } = require('sdk/window/helpers');
const { setTimeout } = require('sdk/timers');
const { isPrivate } = require('sdk/private-browsing');
const { data } = require('sdk/self');
const { fromIterator } = require('sdk/util/array');
const { URL } = require('sdk/url');

const { WebPanel } = require('../ui/web-panel');
const { show, hide } = require('../ui/sidebar/actions');
const { isShowing } = require('../ui/sidebar/state');

const BUILTIN_SIDEBAR_MENUITEMS = [
  'menu_socialSidebar',
  'menu_historySidebar',
  'menu_bookmarksSidebar'
];

const WEB_PANEL_BROWSER_ID = 'web-panels-browser';

function isSidebarShowing(window) {
  window = window || getMostRecentBrowserWindow();
  let sidebar = window.document.getElementById('sidebar-box');
  return !sidebar.hidden;
}

function getSidebarMenuitems(window) {
  window = window || getMostRecentBrowserWindow();
  return fromIterator(window.document.querySelectorAll('#viewSidebarMenu menuitem'));
}

function getExtraSidebarMenuitems() {
  let menuitems = getSidebarMenuitems();
  return menuitems.filter(function(mi) {
    return BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) < 0;
  });
}

function makeID(id) {
  return 'pathfinder-sidebar-' + id;
}

function simulateClick(ele) {
  let window = ele.ownerDocument.defaultView;
  let { document } = window;
  var evt = document.createEvent("XULCommandEvent");
  evt.initCommandEvent("command", true, true, window,
    0, false, false, false, false, null);
  ele.dispatchEvent(evt);
}

exports.testSidebarBasicLifeCycle = function(assert, done) {
  let testName = 'testSidebarBasicLifeCycle';
  let window = getMostRecentBrowserWindow();
  assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
  let sidebarXUL = window.document.getElementById('sidebar');
  assert.ok(sidebarXUL, 'sidebar xul element does exist');
  assert.ok(!getExtraSidebarMenuitems().length, 'there are no extra sidebar menuitems');

  assert.equal(isSidebarShowing(window), false, 'sidebar is not showing 1');
  let sidebarDetails = {
    id: testName,
    title: 'test',
    url: 'data:text/html;charset=utf-8,'+testName
  };
  let sidebar = WebPanel(sidebarDetails);

  // test the sidebar attributes
  for each(let key in Object.keys(sidebarDetails)) {
    assert.equal(sidebarDetails[key], sidebar[key], 'the attributes match the input');
  }

  assert.pass('The Sidebar constructor worked');

  let extraMenuitems = getExtraSidebarMenuitems();
  assert.equal(extraMenuitems.length, 1, 'there is one extra sidebar menuitems');

  let ele = window.document.getElementById(makeID(testName));
  assert.equal(ele, extraMenuitems[0], 'the only extra menuitem is the one for our sidebar.')
  assert.ok(ele, 'sidebar element was added');
  assert.ok(ele.getAttribute('checked'), 'false', 'the sidebar is not displayed');
  assert.equal(ele.getAttribute('label'), sidebar.title, 'the sidebar title is the menuitem label')

  assert.equal(isSidebarShowing(window), false, 'sidebar is not showing 2');
  sidebar.on('show', function() {
    assert.pass('the show event was fired');
    assert.equal(isSidebarShowing(window), true, 'sidebar is not showing 3');
    assert.equal(isShowing(sidebar), true, 'the sidebar is showing');
    assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is displayed');

    sidebar.once('hide', function() {
      assert.pass('the hide event was fired');
      assert.equal(ele.getAttribute('checked'), 'false', 'the sidebar menuitem is not checked');
      assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
      assert.equal(isSidebarShowing(window), false, 'the sidebar elemnt is hidden');

      sidebar.once('detach', function() {
        sidebar.destroy();

        let sidebarMI = getSidebarMenuitems();
        for each (let mi in sidebarMI) {
          assert.ok(BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) >= 0, 'the menuitem is for a built-in sidebar')
          assert.equal(mi.getAttribute('checked'), "false", 'no sidebar menuitem is checked');
        }

        assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
        assert.pass('calling destroy worked without error');

        done();
      });
    });

    sidebar.hide();
    assert.pass('hiding sidebar..');
  });

  sidebar.show();
  assert.pass('showing sidebar..');
}

exports.testSideBarIsInNewWindows = function(assert, done) {
  let testName = 'testSideBarOnNewWindow';
  let sidebar = WebPanel({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  open().then(function(window) {
      let ele = window.document.getElementById(makeID(testName));
      assert.ok(ele, 'sidebar element was added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

      close(window).then(done, assert.fail);
  })
}

exports.testSideBarIsNotInNewPrivateWindows = function(assert, done) {
  let testName = 'testSideBarOnNewWindow';
  let sidebar = WebPanel({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  open(null, { features: { private: true } }).then(function(window) {
      let ele = window.document.getElementById(makeID(testName));
      assert.ok(isPrivate(window), 'the new window is private');
      assert.equal(ele, null, 'sidebar element was not added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

      close(window).then(done, assert.fail);
  })
}

exports.testSideBarIsShowingInNewWindows = function(assert, done) {
  let testName = 'testSideBarIsShowingInNewWindows';
  let sidebar = WebPanel({
    id: testName,
    title: testName,
    url: URL('data:text/html;charset=utf-8,'+testName)
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  let oldEle = ele;
  sidebar.once('show', function() {
    assert.pass('show event fired');

    sidebar.once('attach', function() {
      assert.pass('attach event fired');

      sidebar.once('show', function() {
        let window = getMostRecentBrowserWindow();
        assert.notEqual(startWindow, window, 'window is new');

        let sb = window.document.getElementById('sidebar');
        if (sb && sb.docShell && sb.contentDocument && sb.contentDocument.getElementById('web-panels-browser')) {
          end();
        }
        else {
          sb.addEventListener('DOMWindowCreated', end, false);
        }

        function end() {
          sb.removeEventListener('DOMWindowCreated', end, false);
          let webPanelBrowser = sb.contentDocument.getElementById('web-panels-browser');

          let ele = window.document.getElementById(makeID(testName));

          assert.ok(ele, 'sidebar element was added 2');
          assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is checked');
          assert.notEqual(ele, oldEle, 'there are two different sidebars');

          assert.equal(isShowing(sidebar), true, 'the sidebar is showing in new window');

          webPanelBrowser.contentWindow.addEventListener('load', function onload() {
            webPanelBrowser.contentWindow.addEventListener('load', onload, false);

            sidebar.destroy();

            assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
            assert.ok(!isSidebarShowing(window), 'sidebar in most recent window is not showing');
            assert.ok(!isSidebarShowing(startWindow), 'sidebar in most start window is not showing');
            assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
            assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

            setTimeout(function() {
              close(window).then(done, assert.fail);
            });
          }, false);
        }
      });

      startWindow.OpenBrowserWindow();
    });
  });

  show(sidebar);
  assert.pass('showing the sidebar');
}

exports.testShowingOneSidebarAfterAnother = function(assert, done) {
  let testName = 'testShowingOneSidebarAfterAnother';

  let sidebar1 = WebPanel({
    id: testName + '1',
    title: testName + '1',
    url:  'data:text/html;charset=utf-8,'+ testName + 1
  });
  let sidebar2 = WebPanel({
    id: testName + '2',
    title: testName + '2',
    url:  'data:text/html;charset=utf-8,'+ testName + 2
  });

  let window = getMostRecentBrowserWindow();
  let IDs = [ sidebar1.id, sidebar2.id ];

  let extraMenuitems = getExtraSidebarMenuitems(window);
  assert.equal(extraMenuitems.length, 2, 'there are two extra sidebar menuitems');

  function testShowing(sb1, sb2, sbEle) {
    assert.equal(isShowing(sidebar1), sb1);
    assert.equal(isShowing(sidebar2), sb2);
    assert.equal(isSidebarShowing(window), sbEle);
  }
  testShowing(false, false, false);

  sidebar1.once('show', function() {
    testShowing(true, false, true);
    for each (let mi in getExtraSidebarMenuitems(window)) {
      let menuitemID = mi.getAttribute('id').replace(/^pathfinder-sidebar-/, '');
      assert.ok(IDs.indexOf(menuitemID) >= 0, 'the extra menuitem is for one of our test sidebars');
      assert.equal(mi.getAttribute('checked'), menuitemID == sidebar1.id ? 'true' : 'false', 'the test sidebar menuitem has the correct checked value');
    }

    sidebar2.once('show', function() {
      testShowing(false, true, true);
      for each (let mi in getExtraSidebarMenuitems(window)) {
        let menuitemID = mi.getAttribute('id').replace(/^pathfinder-sidebar-/, '');
        assert.ok(IDs.indexOf(menuitemID) >= 0, 'the extra menuitem is for one of our test sidebars');
        assert.equal(mi.getAttribute('checked'), menuitemID == sidebar2.id ? 'true' : 'false', 'the test sidebar menuitem has the correct checked value');
      }

      sidebar1.destroy();
      sidebar2.destroy();

      testShowing(false, false, false);

      done();
    });

    show(sidebar2);
    assert.pass('showing sidebar 2');
  })
  show(sidebar1);
  assert.pass('showing sidebar 1');
}

exports.testSidebarUnload = function(assert, done) {
  let loader = Loader(module);

  let testName = 'testSidebarUnload';
  let window = getMostRecentBrowserWindow();

  assert.equal(isPrivate(window), false, 'the current window is not private');

  let sidebar = loader.require('pathfinder/ui/web-panel').WebPanel({
    id: testName,
    title: testName,
    url:  'data:text/html;charset=utf-8,'+ testName,
    onShow: function() {
      assert.pass('onShow works for Sidebar');
      loader.unload();

      let sidebarMI = getSidebarMenuitems();
      for each (let mi in sidebarMI) {
        assert.ok(BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) >= 0, 'the menuitem is for a built-in sidebar')
        assert.equal(mi.getAttribute('checked'), 'false', 'no sidebar menuitem is checked');
      }
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.equal(isSidebarShowing(window), false, 'the sidebar is not showing');

      done();
    }
  })

  sidebar.show();
  assert.pass('showing the sidebar');
}

exports.testRemoteContent = function(assert) {
  let testName = 'testRemoteContent';
  try {
    let sidebar = WebPanel({
      id: testName,
      title: testName,
      url: 'http://dne.xyz.mozilla.org'
    });
    assert.ok('the web panel was created!');
    sidebar.destroy();
  }
  catch(e) {
    assert.fail('sidebar was not created..');
  }
}

exports.testInvalidURL = function(assert) {
  let testName = 'testInvalidURL';
  try {
    let sidebar = WebPanel({
      id: testName,
      title: testName,
      url: 'http:mozilla.org'
    });
    assert.pass('remote uris are fine');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "url" must be a valid URI./.test(e), 'invalid URIs are not acceptable');
  }
}

exports.testInvalidURLType = function(assert) {
  let testName = 'testInvalidURLType';
  try {
    let sidebar = WebPanel({
      id: testName,
      title: testName
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "url" must be a valid URI./.test(e), 'invalid URIs are not acceptable');
  }
}

exports.testInvalidTitle = function(assert) {
  let testName = 'testInvalidTitle';
  try {
    let sidebar = WebPanel({
      id: testName,
      title: '',
      url: 'data:text/html;charset=utf-8,'+testName
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.equal('The option "title" must be one of the following types: string', e.message, 'invalid titles are not acceptable');
  }
}

exports.testInvalidID = function(assert) {
  let testName = 'testInvalidTitle';
  try {
    let sidebar = WebPanel({
      id: '!',
      title: testName,
      url: 'data:text/html;charset=utf-8,'+testName
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "id" must be a valid alphanumeric id/.test(e), 'invalid ids are not acceptable');
  }
}

exports.testSidebarIsNotOpenInNewPrivateWindow = function(assert, done) {
  let testName = 'testSidebarIsNotOpenInNewPrivateWindow';
  let window = getMostRecentBrowserWindow();

    let sidebar = WebPanel({
      id: testName,
      title: testName,
      url: 'data:text/html;charset=utf-8,'+testName
    });

    sidebar.on('show', function() {
      assert.equal(isPrivate(window), false, 'the new window is not private');
      assert.equal(isSidebarShowing(window), true, 'the sidebar is showing');
      assert.equal(isShowing(sidebar), true, 'the sidebar is showing');

      let window2 = window.OpenBrowserWindow({private: true});
      windowPromise(window2, 'load').then(focus).then(function() {
        // TODO: find better alt to setTimeout...
        setTimeout(function() {
          assert.equal(isPrivate(window2), true, 'the new window is private');
          assert.equal(isSidebarShowing(window), true, 'the sidebar is showing in old window still');
          assert.equal(isSidebarShowing(window2), false, 'the sidebar is not showing in the new private window');
          assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
          sidebar.destroy();
          close(window2).then(done);
        }, 500)
      })
    });

    sidebar.show();
}

// TEST: edge case where web panel is destroyed while loading
exports.testDestroyEdgeCaseBug = function(assert, done) {
    let testName = 'testDestroyEdgeCaseBug';
    let window = getMostRecentBrowserWindow();
    let sidebar = WebPanel({
      id: testName,
      title: testName,
      url: 'data:text/html;charset=utf-8,'+testName
    });

    // NOTE: purposely not listening to show event b/c the event happens
    //       between now and then.
    sidebar.show();

    assert.equal(isPrivate(window), false, 'the new window is not private');
    assert.equal(isSidebarShowing(window), true, 'the sidebar is showing');

    //assert.equal(isShowing(sidebar), true, 'the sidebar is showing');

    open(null, { features: { private: true } }).then(focus).then(function(window2) {
      assert.equal(isPrivate(window2), true, 'the new window is private');
      assert.equal(isSidebarShowing(window2), false, 'the sidebar is not showing');
      assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');

      sidebar.destroy();
      assert.pass('destroying the sidebar');

      close(window2).then(function() focus(window)).then(function(window) {
        let loader = Loader(module);

        assert.equal(window, getMostRecentBrowserWindow(), 'window is current window');
        assert.equal(isPrivate(window), false, 'the current window is not private!');

        let sidebar = loader.require('pathfinder/ui/web-panel').WebPanel({
          id: testName,
          title: testName,
          url:  'data:text/html;charset=utf-8,'+ testName,
          onShow: function() {
            assert.pass('onShow works for Sidebar');
            loader.unload();

            let sidebarMI = getSidebarMenuitems();
            for each (let mi in sidebarMI) {
              assert.ok(BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) >= 0, 'the menuitem is for a built-in sidebar')
              assert.equal(mi.getAttribute('checked'), 'false', 'no sidebar menuitem is checked');
            }
            assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
            assert.equal(isSidebarShowing(window), false, 'the sidebar is not showing');

            done();
          }
        })

        assert.pass('showing the sidebar1');
        sidebar.show();
        assert.pass('showing the sidebar2');

      });
    });
}

exports.testClickingACheckedMenuitem = function(assert, done) {
  let testName = 'testClickingACheckedMenuitem';
  let window = getMostRecentBrowserWindow();
  let sidebar = WebPanel({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,'+testName,
    onShow: function() {
      sidebar.once('hide', function() {
        assert.pass('clicking the menuitem after the sidebar has shown hides it.');
        sidebar.destroy();
        done();
      });
      let menuitem = window.document.getElementById(makeID(sidebar.id));
      simulateClick(menuitem);
    }
  });

  sidebar.show();
}

exports.testAddonGlobalDNE = function(assert, done) {
  let testName = 'testAddonGlobal';
  let url = 'data:text/html;charset=utf-8,'+encodeURIComponent('<script>window.addEventListener("message", function() window.postMessage({ addon: !!window.addon }, "*"), false)</script>');
  let sidebar = WebPanel({
    id: testName,
    title: testName,
    url: url
  });

  sidebar.on('attach', function(worker) {
    assert.pass('sidebar was attached');
    assert.ok(!!worker, 'attach event has worker');

    let sidebarXUL = getMostRecentBrowserWindow().document.getElementById('sidebar');
    let window = sidebarXUL.contentDocument.getElementById(WEB_PANEL_BROWSER_ID).contentWindow;

    window.addEventListener('load', function() {
      let count = 0;
      window.addEventListener('message', function({ data: msg }) {
        if (++count != 2) return;

        assert.equal(msg.addon, false, 'the addon global DNE');

        sidebar.destroy();

        done();
      }, false);
      window.postMessage('', '*');
    }, false);

  });

  show(sidebar);
}

require('sdk/test').run(exports);
