// client/src/lib/near-wallet.ts
import HOT from '@hot-wallet/sdk';

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  wallet?: any; // Оставляем wallet, как в оригинале
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
    
    // Проверяем, запущено ли приложение внутри Telegram WebApp
    const isTelegramWebApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
    
    let response;
    if (isTelegramWebApp) {
      // Для Telegram WebApp используем методы с префиксом near:, как в setupHotWallet.ts
      console.log("Connecting via Telegram WebApp");
      response = await wallet.request('near:signIn', {});
    } else {
      // Для расширения браузера используем старый API
      console.log("Connecting via browser extension");
      response = await wallet.request('signIn', {
        contractId: import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 'easy-proxy.near',
        methodNames: ['nft_mint_proxy'],
      });
    }
    
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
  } catch (error: any) {
    console.error('Wallet connection error:', error);
    // Добавим больше информации об ошибке
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // Обработка специфичных ошибок Telegram WebApp
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const wallet = getWalletInstance();
    
    // Проверяем, запущено ли приложение внутри Telegram WebApp
    const isTelegramWebApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
    
    if (isTelegramWebApp) {
      // Для Telegram WebApp используем методы с префиксом near:
      console.log("Disconnecting via Telegram WebApp");
      await wallet.request('near:signOut', {});
    } else {
      // Для расширения браузера используем старый API
      console.log("Disconnecting via browser extension");
      await wallet.request('signOut', {});
    }
    
    // Clear local storage
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
    walletInstance = null;
  } catch (error) {
    console.error('Wallet disconnection error:', error);
     // Даже если ошибка, очищаем localStorage
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
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
    
    // Проверяем, запущено ли приложение внутри Telegram WebApp
    const isTelegramWebApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
    
    let result;
    if (isTelegramWebApp) {
      // Для Telegram WebApp используем методы с префиксом near: и структуру transactions
      console.log("Signing transaction via Telegram WebApp");
      result = await walletInfo.wallet.request('near:signAndSendTransactions', {
        transactions: [
          {
            receiverId: params.receiverId,
            actions: params.actions,
          }
        ]
      });
      // Обработка результата согласно структуре из SDK (transactions[0])
      const transactionResult = result?.transactions?.[0];
      if (!transactionResult) {
          throw new Error('Transaction result is empty or malformed');
      }
      result = transactionResult;
    } else {
      // Для расширения браузера используем старый API
      console.log("Signing transaction via browser extension");
      result = await walletInfo.wallet.request('signAndSendTransaction', params);
    }
    
    return {
      success: true,
      transactionHash: result.transaction?.hash,
      transaction_outcome: result.transaction_outcome,
      transaction: result.transaction,
      result,
    };
  } catch (error: any) {
    console.error('Transaction signing error:', error);
    // Добавим больше информации об ошибке
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // Обработка специфичных ошибок Telegram WebApp
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
