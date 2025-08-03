import HOT from '@hot-wallet/sdk';

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  wallet?: any;
}

let walletInstance: any = null;

// Initialize wallet instance
function getWalletInstance(): any {
  if (!walletInstance) {
    walletInstance = HOT;
  }
  return walletInstance;
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const wallet = getWalletInstance();
    
    // Request wallet connection using HOT extension
    const response = await wallet.request('signIn', {
      contractId: import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 'easy-proxy.near',
      methodNames: ['nft_mint_proxy'],
    });

    if (response && response.accountId) {
      // Store connection state
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      
      return {
        isConnected: true,
        accountId: response.accountId,
        wallet,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Wallet connection error:', error);
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const wallet = getWalletInstance();
    await wallet.request('signOut', {});
    
    // Clear local storage
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
    
    walletInstance = null;
  } catch (error) {
    console.error('Wallet disconnection error:', error);
  }
}

export async function getConnectedWallet(): Promise<WalletInfo> {
  try {
    const isConnected = localStorage.getItem('near_wallet_connected') === 'true';
    const accountId = localStorage.getItem('near_wallet_account_id');
    
    if (isConnected && accountId) {
      const wallet = getWalletInstance();
      return {
        isConnected: true,
        accountId,
        wallet,
      };
    }
    
    return {
      isConnected: false,
      accountId: null,
    };
  } catch (error) {
    console.error('Error checking wallet status:', error);
    return {
      isConnected: false,
      accountId: null,
    };
  }
}

export async function signAndSendTransaction(params: {
  receiverId: string;
  actions: any[];
}): Promise<any> {
  try {
    const walletInfo = await getConnectedWallet();
    
    if (!walletInfo.isConnected || !walletInfo.wallet) {
      throw new Error('Wallet not connected');
    }

    const result = await walletInfo.wallet.request('signAndSendTransaction', params);

    return {
      success: true,
      transactionHash: result.transaction?.hash,
      transaction_outcome: result.transaction_outcome,
      transaction: result.transaction,
      result,
    };
  } catch (error) {
    console.error('Transaction signing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}