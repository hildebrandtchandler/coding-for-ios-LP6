//@ts-check

const UUID_KEY = 'subscription-uuid';

function urlBase64ToUint8Array(base64String) {
  // this code borrowed from:
  // https://www.npmjs.com/package/web-push
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function updateUI() {
  console.log('updateUI()');
  // does the browser support notification?
  if (("Notification" in window)) {
    document.getElementById("subscribeDiv").style.display = 'block';
  } else {
    // no? Then display a warning
    document.getElementById("noNotificationsWarning").style.display = 'block';
  }
}

function postRegistration(subscription) {
  const serverUrl = `${location.origin}/api/subscribe`;

  return new Promise((resolve, reject) => {
    if (subscription) {
      // build the URL to the app's APIs
      console.log(`Submitting subscription to ${serverUrl}`);

      // the data we're passing to the server
      const data = {
        subscription: subscription,
        name: `${platform.name} (${platform.version})`,
        platformName: platform.name,
        platformVersion: platform.version,
        platformLayout: platform.layout,
        platformOS: platform.os,
        platformDesc: platform.description
      };

      // POST the data to the server
      fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(response => {
          console.log('Received response from the server');
          if (response.status == 201) {
            console.log('Subscription submitted');
            response.json()
              .then(data => {
                console.log(`UUID: ${data.uuid}`);
                localStorage.setItem(UUID_KEY, data.uuid);
                resolve();
              })
          } else {
            // tell the user it failed
            Swal.fire('POST Error', response.statusText, 'error');
            reject(response.statusText);
          }
        });
    } else {
      reject('Missing endpoint value');
    }
  });
}

function doSubscribe() {
  Notification.requestPermission().then(result => {
    switch (result) {
      case 'granted':
  // the user gave us permission,
  // so go ahead and do the registration
  console.log('Permission granted');
  navigator.serviceWorker.ready.then(registration => {
    console.log('Checking subscription');
    // check to make sure the browser isn't already subscribed
    registration.pushManager.getSubscription()
      .then(subscription => {
        if (subscription) {
          console.log('Browser is already subscribed');
          Swal.fire({
            type: 'info',
            title: 'Subscribe',
            text: 'This browser is already subscribed for notifications'
          });
        } else {
          // subscribe the browser
          console.log('Subscribing the browser');
          var subOptions = {
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(Config.VAPID_PUBLIC)
          };
          registration.pushManager.subscribe(subOptions)
            .then(subscription => {
              console.log('Browser subscribed');
              registration.showNotification('I read Learning PWA, and ' +
                'all I got was this silly notification!');
              postRegistration(subscription)
                .then(() => {
                  console.log('Subscription POSTed to server');
                  updateUI();
                  Swal.fire({
                    type: 'info',
                    title: 'Subscribe',
                    text: 'The browser was successfully subscribed for notifications',
                    timer: 2000
                  });
                })
                .catch(error => {
                  console.error(error);
                })
            })
            .catch(error => {
              // hmmm, that didn't work
              console.error(error);
              // tell the user what we can
              Swal.fire({
                type: 'error',
                title: 'Subscribe Error',
                text: error
              });
            });
        }
      });
    updateUI();
  });
  break;
      case 'denied':
        // code block
        console.error('Denied');
        Swal.fire({
          type: 'info',
          title: 'Subscribe',
          text: 'You denied access to notifications.',
          footer: 'Please try again when you are ready.'
        });
        break;
      default:
        // the user closed the permissions dialog
        // without making a selection
        console.warn('Default');
        Swal.fire({
          type: 'info',
          title: 'Subscribe',
          text: 'Dialog closed without making a selection.',
          footer: 'Please try again later.'
        });
    }
  });
}

function updateUI() {
  console.log('updateUI()');
  // does the browser support notification?
  if (("Notification" in window)) {
    navigator.serviceWorker.ready.then(registration => {
      // check to make sure the browser isn't already subscribed
      registration.pushManager.getSubscription()
        .then(subscription => {
          if (subscription) {
            console.log('Browser is already subscribed');
            document.getElementById("subscribeDiv").style.display = 'none';
            document.getElementById("unsubscribeDiv").style.display = 'block';
          } else {
            // no? Then unhide the subscribe div
            document.getElementById("subscribeDiv").style.display = 'block';
            document.getElementById("unsubscribeDiv").style.display = 'none';
          }
        })
    });
  } else {
    // no? Then display a warning
    document.getElementById("noNotificationsWarning").style.display = 'block';
  }
}

function doUnsubscribe() {
  navigator.serviceWorker.ready.then(registration => {
    registration.pushManager.getSubscription()
      .then(subscription => {
        subscription.unsubscribe()
          .then(status => {
            console.log(`doUnsubscribe: status: ${status}`);
            if (status) {
              updateUI();
              Swal.fire({
                type: 'info',
                title: 'Unsubscribe',
                text: 'Successfully unsubscribed',
                timer: 2000
              });
              // get the UUID from storage
              let uuid = localStorage.getItem(UUID_KEY);
              // do we have a UUID?
              if (uuid) {
                // build a server URL using it
                let serverUrl =
                 `${location.origin}/api/unsubscribe/${uuid}`;
                // POST the data to the server
                fetch(serverUrl, { method: 'POST' })
                  .then(response => {
                    console.log(`doUnsubscribe: ${response.status} response`);
                  });
              }
            } else {
              Swal.fire({
                type: 'error',
                title: 'Unsubscribe Error',
                text: "I'm not sure what happened here"
              });
            }
          });
      });
  });
}

// set the click event for the `Subscribe` button
document.getElementById("btnSubscribe").addEventListener("click", doSubscribe);
document.getElementById("btnUnsubscribe").addEventListener("click", doUnsubscribe);

// update the UI based on current subscription status
updateUI();
