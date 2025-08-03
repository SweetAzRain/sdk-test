// client/src/lib/near-wallet.ts
import HOT from '@hot-wallet/sdk';

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  wallet?: typeof HOT; // Уточняем тип
}

let walletInstance: typeof HOT | null = null;

// Получаем инстанс кошелька
function getWalletInstance(): typeof HOT | null {
  // HOT SDK сам проверяет isInjected внутри request
  if (!walletInstance) {
    walletInstance = HOT;
  }
  return walletInstance;
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const wallet = getWalletInstance();
    
    if (!wallet) {
      console.error('HOT Wallet provider is not available.');
      return null;
    }

    // Используем правильный метод с префиксом 'near:'
    // setupHotWallet.ts показывает, что signIn внутри SDK не принимает contractId/methodNames напрямую в request
    // Эти параметры обрабатываются позже, при signAndSendTransaction или внутри SDK
    const response = await wallet.request('near:signIn', {});
    
    if (response && response.accountId) {
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      return {
        isConnected: true,
        accountId: response.accountId,
        wallet, // Передаем инстанс кошелька
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
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const wallet = getWalletInstance();
    if (!wallet) {
      console.warn('Cannot disconnect: HOT Wallet provider is not available.');
      return;
    }

    // Используем правильный метод с префиксом
    await wallet.request('near:signOut', {});
    
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
    walletInstance = null; // Сбросим инстанс при отключении
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
    // setupHotWallet.ts показывает, что внутри signAndSendTransaction SDK оборачивает параметры
    const result = await walletInfo.wallet.request('near:signAndSendTransactions', {
       transactions: [
         {
           receiverId: params.receiverId,
           actions: params.actions,
           // signerId SDK может подставить автоматически
         }
       ]
    });

    // Обработка результата согласно структуре из SDK (transactions[0])
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
