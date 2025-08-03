import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { connectWallet as connectHotWallet, disconnectWallet as disconnectHotWallet, getConnectedWallet, signAndSendTransaction as signTransaction } from "@/lib/near-wallet";
import { useToast } from "@/hooks/use-toast";

interface NearWalletContextType {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  accountId: string | null;
  walletName: string;
  network: "mainnet" | "testnet";
  // Wallet operations
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signAndSendTransaction: (params: any) => Promise<any>;
  // UI state
  setNetwork: (network: "mainnet" | "testnet") => void;
}

const NearWalletContext = createContext<NearWalletContextType | undefined>(undefined);

interface NearWalletProviderProps {
  children: ReactNode;
}

export function NearWalletProvider({ children }: NearWalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState("HOT Wallet");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("testnet");
  const { toast } = useToast();

  // Check wallet connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      const walletInfo = await getConnectedWallet();
      if (walletInfo.isConnected && walletInfo.accountId) {
        setIsConnected(true);
        setAccountId(walletInfo.accountId);
        setWalletName("HOT Wallet");
      }
    };
    
    checkConnection();
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      const walletInfo = await connectHotWallet();
      
      if (walletInfo && walletInfo.isConnected && walletInfo.accountId) {
        setIsConnected(true);
        setAccountId(walletInfo.accountId);
        setWalletName("HOT Wallet");
        
        toast({
          title: "Success",
          description: "Wallet connected successfully!",
        });
      } else {
        throw new Error("Failed to connect wallet");
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const disconnectWallet = useCallback(async () => {
    try {
      await disconnectHotWallet();
      setIsConnected(false);
      setAccountId(null);
      setWalletName("HOT Wallet");
      
      toast({
        title: "Disconnected",
        description: "Wallet disconnected",
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Disconnect Failed",
        description: "Error disconnecting wallet",
        variant: "destructive",
      });
    }
  }, [toast]);

  const signAndSendTransaction = useCallback(async (params: any) => {
    try {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      const result = await signTransaction(params);
      
      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }
      
      return result;
    } catch (error: any) {
      console.error('Transaction error:', error);
      
      // If wallet is not connected, update state
      if (error?.message?.includes('not connected')) {
        setIsConnected(false);
        setAccountId(null);
      }
      
      throw error;
    }
  }, [isConnected]);

  const handleNetworkChange = useCallback((newNetwork: "mainnet" | "testnet") => {
    if (isConnected) {
      toast({
        title: "Warning",
        description: "Please disconnect wallet before changing network",
        variant: "destructive",
      });
      return;
    }
    setNetwork(newNetwork);
  }, [isConnected, toast]);

  const value: NearWalletContextType = {
    isConnected,
    isConnecting,
    accountId,
    walletName,
    network,
    connectWallet,
    disconnectWallet,
    signAndSendTransaction,
    setNetwork: handleNetworkChange,
  };

  return (
    <NearWalletContext.Provider value={value}>
      {children}
    </NearWalletContext.Provider>
  );
}

export function useNearWallet() {
  const context = useContext(NearWalletContext);
  if (context === undefined) {
    throw new Error('useNearWallet must be used within a NearWalletProvider');
  }
  return context;
}