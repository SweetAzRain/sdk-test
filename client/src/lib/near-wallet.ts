// client/src/lib/near-wallet.ts
// КОД ИЗ worknahui.txt С ИСПРАВЛЕННЫМ ВЫЗОВОМ HOT.request
import HOT from '@hot-wallet/sdk'; // HOT - это инстанс класса из SDK

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  // Убираем wallet из возвращаемого объекта, чтобы не передавать потенциально проблемный инстанс
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    // console.log("HOT Wallet: Attempting to connect using HOT.request('near:signIn', {})");
    // ВСЕГДА вызываем HOT.request напрямую. SDK сам определит контекст (расширение, injected, Telegram fallback).
    const response = await HOT.request('near:signIn', {});
    // console.log("HOT Wallet: SignIn response:", response);

    if (response && response.accountId) {
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      // Не возвращаем сам провайдер, чтобы избежать проблем с сериализацией или повторным использованием
      return {
        isConnected: true,
        accountId: response.accountId,
      };
    }
    // console.warn('HOT Wallet: SignIn response does not contain accountId:', response);
    return null;
  } catch (error: any) {
    console.error('HOT Wallet connection error:', error);
    if (error && error.message) {
      console.error('HOT Wallet Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('HOT Wallet Error stack:', error.stack);
    }
    // Проверим, не является ли это ошибкой из fallback-механизма SDK (iframe/polling)
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    // console.log("HOT Wallet: Attempting to disconnect using HOT.request('near:signOut', {})");
    // ВСЕГДА вызываем HOT.request напрямую. SDK сам определит контекст.
    await HOT.request('near:signOut', {});
    
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
  } catch (error) {
    console.error('HOT Wallet disconnection error:', error);
    // Даже если ошибка, очищаем localStorage, чтобы UI не застрял в "подключенном" состоянии
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
  }
}

export async function getConnectedWallet(): Promise<WalletInfo> {
  try {
    const isConnected = localStorage.getItem('near_wallet_connected') === 'true';
    const accountId = localStorage.getItem('near_wallet_account_id');
    
    if (isConnected && accountId) {
      // При проверке статуса не пытаемся снова подключаться, просто возвращаем сохраненные данные
      return {
        isConnected: true,
        accountId,
      };
    }
    return {
      isConnected: false,
      accountId: null,
    };
  } catch (error) {
    console.error('HOT Wallet: Error checking wallet status:', error);
    return {
      isConnected: false,
      accountId: null,
    };
  }
}

export async function signAndSendTransaction(params: {
  receiverId: string;
  actions: any[]; // Ожидаем, что actions уже в формате, понятном SDK
}): Promise<any> {
  try {
    const isConnected = localStorage.getItem('near_wallet_connected') === 'true';
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    // console.log("HOT Wallet: Attempting to sign transaction using HOT.request('near:signAndSendTransactions', ...)");
    // console.log("HOT Wallet: Transaction params:", params);
    
    // ВСЕГДА вызываем HOT.request напрямую. SDK сам определит контекст.
    const result = await HOT.request('near:signAndSendTransactions', {
       transactions: [
         {
           receiverId: params.receiverId,
           actions: params.actions,
           // signerId SDK может подставить автоматически
         }
       ]
    });
    // console.log("HOT Wallet: Transaction result:", result);

    // Обработка результата согласно структуре из SDK (transactions[0])
    const transactionResult = result?.transactions?.[0];
    if (!transactionResult) {
        throw new Error('Transaction result is empty or malformed');
    }

    return {
      success: true,
      transactionHash: transactionResult?.transaction?.hash || transactionResult?.transaction_outcome?.id,
      transaction_outcome: transactionResult?.transaction_outcome,
      transaction: transactionResult?.transaction,
      result: transactionResult,
    };

  } catch (error: any) {
    console.error('HOT Wallet: Transaction signing error:', error);
    if (error && error.message) {
      console.error('HOT Wallet: Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('HOT Wallet: Error stack:', error.stack);
    }
    // Проверим, не является ли это ошибкой из fallback-механизма SDK
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during transaction signing',
    };
  }
}
