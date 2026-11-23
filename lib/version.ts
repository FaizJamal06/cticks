// The app's write-path version. Bump it in any release that changes what the app writes or which API it calls,
// so an older copy still open on someone's phone is asked to reload instead of failing in a confusing way:
// the app compares its own number with the server's (/api/version) and shows a Reload bar, and the API routes
// refuse requests from an older app with UPDATE_MSG (HTTP 426).
//   1 = before Pay or Dare (the app started rounds itself)
//   2 = Pay or Dare (rounds start on the server; firestore.rules phase B denies the old direct write)
export const APP_VERSION = 2;
export const UPDATE_MSG = "cTicks was updated. Close and reopen the app to keep going.";
