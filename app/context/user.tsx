import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserContext = {
  username: string | null;
  deviceId: string;
  setUsername: (name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const UserCtx = createContext<UserContext>({
  username: null,
  deviceId: '',
  setUsername: async () => {},
  logout: async () => {},
});

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    async function init() {
      const [storedUser, storedDevice] = await Promise.all([
        AsyncStorage.getItem('username'),
        AsyncStorage.getItem('device_id'),
      ]);
      if (storedUser) setUsernameState(storedUser);
      if (storedDevice) {
        setDeviceId(storedDevice);
      } else {
        const newId = generateUUID();
        await AsyncStorage.setItem('device_id', newId);
        setDeviceId(newId);
      }
    }
    init();
  }, []);

  async function setUsername(name: string) {
    await AsyncStorage.setItem('username', name);
    setUsernameState(name);
  }

  async function logout() {
    await AsyncStorage.removeItem('username');
    setUsernameState(null);
  }

  return (
    <UserCtx.Provider value={{ username, deviceId, setUsername, logout }}>
      {children}
    </UserCtx.Provider>
  );
}

export const useUser = () => useContext(UserCtx);
