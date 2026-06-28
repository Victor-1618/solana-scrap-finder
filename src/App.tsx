import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnectionProvider } from './components/WalletConnectionProvider';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import './App.css';

function AppContent() {
  const { publicKey } = useWallet();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 w-full pb-16">
        {publicKey ? <Dashboard /> : <LandingPage />}
      </main>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <WalletConnectionProvider>
      <AppContent />
    </WalletConnectionProvider>
  );
};

export default App;
