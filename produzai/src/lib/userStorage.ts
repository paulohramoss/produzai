// Wraps localStorage with a per-user UID prefix so each user's data is isolated.
// Call setUserStorageUid(uid) right after login; call setUserStorageUid('') on logout.

let currentUid = ''

export function setUserStorageUid(uid: string) {
  currentUid = uid
}

function key(name: string) {
  return currentUid ? `${currentUid}:${name}` : name
}

export const userStorage = {
  getItem:    (name: string): string | null => localStorage.getItem(key(name)),
  setItem:    (name: string, value: string): void => localStorage.setItem(key(name), value),
  removeItem: (name: string): void => localStorage.removeItem(key(name)),
}
