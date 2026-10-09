const memoryStore = new Map<string, string>();

function getStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage === 'undefined') {
    return {
      getItem: (key) => memoryStore.get(key) ?? null,
      setItem: (key, value) => {
        memoryStore.set(key, value);
      },
      removeItem: (key) => {
        memoryStore.delete(key);
      },
    };
  }

  return localStorage;
}

export const authStorage = {
  getItem: (key: string) => getStore().getItem(key),
  setItem: (key: string, value: string) => {
    getStore().setItem(key, value);
  },
  removeItem: (key: string) => {
    getStore().removeItem(key);
  },
};
