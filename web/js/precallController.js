/* global Modal, OTNetworkTest, PrecallView */

!(function (exports) {
  'use strict';

  var endPrecall = function () {
    Utils.sendEvent('PrecallController:endPrecall');
  };
  var otNetworkTest;
  var publisher;
  var previewOptions;
  var publisherOptions = {
    publishAudio: true,
    publishVideo: true,
    name: ''
  };

  var videoPreviewEventHandlers = {
    initialAudioSwitch: function (evt) {
      publisher.publishAudio(evt.detail.status);
      publisherOptions.publishAudio = evt.detail.status;
    },
    initialVideoSwitch: function (evt) {
      publisher.publishVideo(evt.detail.status);
      publisherOptions.publishVideo = evt.detail.status;
    },
    retest: function () {
      PrecallView.startPrecallTestMeter();
      otNetworkTest.startNetworkTest(function (error, result) {
        if (!error) {
          PrecallView.displayNetworkTestResults(result);
        }
      });
    }
  };

  function showCallSettingsPrompt(roomName, username, otHelper) {
    var selector = '.user-name-modal';
    return new Promise(function (resolve) {
      function loadModalText() {
        PrecallView.setRoomName(roomName);
        PrecallView.setUsername(username);
        PrecallView.setFocus(username);

        if (Utils.isIE()) PrecallView.hideConnectivityTest();

        document.querySelector('.user-name-modal #enter').disabled = false;
        document.querySelector('.user-name-modal .tc-dialog').addEventListener('submit', function (event) {
          event.preventDefault();
          PrecallView.hide();
          publisher.destroy();
          if (!Utils.isIE()) {
            otNetworkTest.stopTest();
          }
          Modal.hide(selector)
            .then(function () {
              publisherOptions.name = document.querySelector(selector + ' input').value.trim();
              setTimeout(function () {
                resolve({
                  username: document.querySelector(selector + ' input').value.trim(),
                  publisherOptions: publisherOptions
                });
              }, 1);
            });
        });

        otHelper.initPublisher('video-preview',
          { width: '100%', height: '100%', insertMode: 'append', showControls: false }
        ).then(function (pub) {
          publisher = pub;
          previewOptions = {
            apiKey: window.apiKey,
            resolution: '640x480',
            sessionId: window.precallSessionId,
            token: window.precallToken
          };
          PrecallView.startPrecallTestMeter();

          // You cannot use the network test in IE. IE cannot subscribe to its own stream.
          if (!Utils.isIE()) {
            otNetworkTest = new OTNetworkTest(previewOptions);
            otNetworkTest.startNetworkTest(function (error, result) {
              PrecallView.displayNetworkTestResults(result);
              if (result.audioOnly) {
                publisher.publishVideo(false);
                Utils.sendEvent('PrecallController:audioOnly');
              }
            });
          }

          Utils.addEventsHandlers('roomView:', videoPreviewEventHandlers, exports);
          var movingAvg = null;
          publisher.on('audioLevelUpdated', function (event) {
            if (movingAvg === null || movingAvg <= event.audioLevel) {
              movingAvg = event.audioLevel;
            } else {
              movingAvg = (0.8 * movingAvg) + (0.2 * event.audioLevel);
            }

            // 1.5 scaling to map the -30 - 0 dBm range to [0,1]
            var logLevel = ((Math.log(movingAvg) / Math.LN10) / 1.5) + 1;
            logLevel = Math.min(Math.max(logLevel, 0), 1);
            PrecallView.setVolumeMeterLevel(logLevel);
          });
        });

        if (username) {
          document.getElementById('enter-name-prompt').style.display = 'none';
          var userNameInputElement = document.getElementById('user-name-input');
          userNameInputElement.value = username;
          userNameInputElement.setAttribute('readonly', true);
        }
      }
      otHelper.otLoaded.then(function () {
        return Modal.show(selector, loadModalText).then(function () {
          PrecallView.setFocus(username);
        });
      });
    });
  }

  var eventHandlers = {
    'roomView:endprecall': endPrecall
  };

  var init = function () {
    return new Promise(function (resolve) {
      LazyLoader.dependencyLoad([
        '/js/vendor/ejs_production.js',
        '/js/precallView.js'
      ]).then(function () {
        Utils.addEventsHandlers('', eventHandlers);
        return PrecallView.init();
      }).then(function () {
        resolve();
      });
    });
  };

  exports.PrecallController = {
    init: init,
    showCallSettingsPrompt: showCallSettingsPrompt
  };
}(this));