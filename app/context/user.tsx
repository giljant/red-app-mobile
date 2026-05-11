import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserContext = {
  username: string | null;
  setUsername: (name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const UserCtx = createContext<UserContext>({
  username: null,
  setUsername: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsernameState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('username').then(val => {
      if (val) setUsernameState(val);
    });
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
    <UserCtx.Provider value={{ username, setUsername, logout }}>
      {children}
    </UserCtx.Provider>
  );
}

export const useUser = () => useContext(UserCtx);