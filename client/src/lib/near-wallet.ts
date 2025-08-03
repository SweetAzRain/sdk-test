// client/src/lib/near-wallet.ts
// КОД ИЗ worknahui.txt С ДОБАВЛЕННОЙ ПОДДЕРЖКОЙ TELEGRAM WEBAPP
import HOT from '@hot-wallet/sdk';

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  wallet?: any;
}

let walletInstance: any = null;

// Initialize wallet instance (Оставлено как в worknahui.txt)
function getWalletInstance(): any {
  if (!walletInstance) {
    walletInstance = HOT;
  }
  return walletInstance;
}

// Проверяем, запущено ли приложение внутри Telegram WebApp (НОВОЕ)
function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const wallet = getWalletInstance();
    
    // Проверка, запущено ли в Telegram WebApp (НОВОЕ)
    const useTelegramAPI = isTelegramWebApp();
    
    let response;
    if (useTelegramAPI) {
      // Используем API для Telegram WebApp (НОВОЕ)
      console.log("HOT: Connecting via Telegram WebApp");
      // setupHotWallet.ts показывает, что для Telegram используется 'near:signIn'
      response = await wallet.request('near:signIn', {});
    } else {
      // Ваш оригинальный рабочий код для расширения (БЕЗ ИЗМЕНЕНИЙ)
      console.log("HOT: Connecting via browser extension");
      response = await wallet.request('signIn', {
        contractId: import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 'easy-proxy.near',
        methodNames: ['nft_mint_proxy'],
      });
    }

    if (response && response.accountId) {
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
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // Обработка специфичной ошибки Telegram WebApp (НОВОЕ)
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const wallet = getWalletInstance();
    
    // Проверка, запущено ли в Telegram WebApp (НОВОЕ)
    const useTelegramAPI = isTelegramWebApp();
    
    if (useTelegramAPI) {
      // Используем API для Telegram WebApp (НОВОЕ)
      console.log("HOT: Disconnecting via Telegram WebApp");
      // setupHotWallet.ts показывает, что для Telegram используется 'near:signOut'
      await wallet.request('near:signOut', {});
    } else {
      // Ваш оригинальный рабочий код для расширения (БЕЗ ИЗМЕНЕНИЙ)
      console.log("HOT: Disconnecting via browser extension");
      await wallet.request('signOut', {});
    }
    
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
    walletInstance = null;
  } catch (error) {
    console.error('Wallet disconnection error:', error);
    // Очищаем localStorage даже если ошибка
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
    
    // Проверка, запущено ли в Telegram WebApp (НОВОЕ)
    const useTelegramAPI = isTelegramWebApp();
    
    let result;
    if (useTelegramAPI) {
      // Используем API для Telegram WebApp (НОВОЕ)
      console.log("HOT: Signing transaction via Telegram WebApp");
      console.log("HOT: Transaction params:", params);
      // setupHotWallet.ts показывает, что для Telegram используется 'near:signAndSendTransactions'
      const sdkResult = await walletInfo.wallet.request('near:signAndSendTransactions', {
        transactions: [
          {
            receiverId: params.receiverId,
            actions: params.actions,
          }
        ]
      });
      console.log("HOT: Transaction result from SDK:", sdkResult);
      // Обработка результата согласно структуре из SDK (transactions[0])
      const transactionResult = sdkResult?.transactions?.[0];
      if (!transactionResult) {
          throw new Error('Transaction result is empty or malformed');
      }
      result = transactionResult;
    } else {
      // Ваш оригинальный рабочий код для расширения (БЕЗ ИЗМЕНЕНИЙ)
      console.log("HOT: Signing transaction via browser extension");
      console.log("HOT: Transaction params:", params);
      result = await walletInfo.wallet.request('signAndSendTransaction', params);
      console.log("HOT: Transaction result from SDK:", result);
    }
    
    return {
      success: true,
      transactionHash: result.transaction?.hash || result.transaction_outcome?.id,
      transaction_outcome: result.transaction_outcome,
      transaction: result.transaction,
      result,
    };
  } catch (error: any) {
    console.error('Transaction signing error:', error);
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // Обработка специфичной ошибки Telegram WebApp (НОВОЕ)
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
