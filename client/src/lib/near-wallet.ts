// client/src/lib/near-wallet.ts
import HOT from '@hot-wallet/sdk';

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  wallet?: typeof HOT;
}

let walletInstance: typeof HOT | null = null;

// Получаем инстанс кошелька
function getWalletInstance(): typeof HOT | null {
  if (!walletInstance) {
    walletInstance = HOT;
  }
  return walletInstance;
}

// Проверяем, запущено ли приложение внутри Telegram WebApp
function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const wallet = getWalletInstance();
    
    if (!wallet) {
      console.error('HOT Wallet provider is not available.');
      return null;
    }

    // Для Telegram WebApp используем специальную логику
    if (isTelegramWebApp()) {
      console.log("Connecting via Telegram WebApp");
      // HOT SDK сам обработает Telegram WebApp внутри request
    }

    // Используем правильный метод с префиксом 'near:'
    const response = await wallet.request('near:signIn', {});
    
    if (response && response.accountId) {
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      return {
        isConnected: true,
        accountId: response.accountId,
        wallet,
      };
    }
    console.warn('SignIn response does not contain accountId:', response);
    return null;
  } catch (error: any) {
    console.error('Wallet connection error:', error);
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
    if (!wallet) {
      console.warn('Cannot disconnect: HOT Wallet provider is not available.');
      // Очищаем localStorage даже если провайдер недоступен
      localStorage.removeItem('near_wallet_connected');
      localStorage.removeItem('near_wallet_account_id');
      return;
    }

    // Используем правильный метод с префиксом
    await wallet.request('near:signOut', {});
    
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
    walletInstance = null; // Сбросим инстанс при отключении
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
        wallet: wallet || undefined, 
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

    // Используем правильный метод с префиксом и структурой из SDK
    const result = await walletInfo.wallet.request('near:signAndSendTransactions', {
       transactions: [
         {
           receiverId: params.receiverId,
           actions: params.actions,
         }
       ]
    });

    // Обработка результата согласно структуре из SDK
    const transactionResult = result?.transactions?.[0];
    if (!transactionResult) {
        throw new Error('Transaction result is empty');
    }

    return {
      success: true,
      transactionHash: transactionResult?.transaction?.hash || transactionResult?.transaction_outcome?.id,
      transaction_outcome: transactionResult?.transaction_outcome,
      transaction: transactionResult?.transaction,
      result: transactionResult,
    };

  } catch (error: any) {
    console.error('Transaction signing error:', error);
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
      error: error instanceof Error ? error.message : 'Unknown error occurred during transaction signing',
    };
  }
}
