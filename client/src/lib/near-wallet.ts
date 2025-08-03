// client/src/lib/near-wallet.ts
import HOT from '@hot-wallet/sdk';

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  // Намеренно не возвращаем объект wallet, чтобы избежать проблем с сериализацией или передачей проблемного инстанса.
  // HOT SDK сам знает, как обрабатывать запросы.
}

// Проверяем, запущено ли приложение внутри Telegram WebApp
function isRunningInTelegramWebApp(): boolean {
  // Безопасная проверка наличия Telegram WebApp API
  if (typeof window === 'undefined') return false;
  const win = window as any;
  // Проверяем наличие объекта Telegram и WebApp внутри него
  return !!(win.Telegram && win.Telegram.WebApp);
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    // console.log("Attempting to connect wallet...");
    // console.log("HOT object:", HOT);
    // console.log("HOT typeof:", typeof HOT);
    // console.log("HOT.request typeof:", typeof (HOT as any)?.request);
    // console.log("HOT.isInjected:", (HOT as any)?.isInjected);
    // console.log("isRunningInTelegramWebApp:", isRunningInTelegramWebApp());

    // Проверка 1: Существует ли HOT и является ли он объектом?
    if (!HOT || typeof HOT !== 'object') {
       console.error("HOT Wallet SDK instance is not available or not an object.");
       return null;
    }

    // Проверка 2: Существует ли метод request?
    const hotRequest = (HOT as any).request;
    if (typeof hotRequest !== 'function') {
       console.error("HOT Wallet SDK instance does not have a callable 'request' method.", { HOT });
       return null;
    }

    const isTelegramWebApp = isRunningInTelegramWebApp();
    let response: any;

    if (isTelegramWebApp) {
      // console.log("Using Telegram WebApp flow (near:signIn)");
      // Для Telegram WebApp используем методы с префиксом near:, как в setupHotWallet.ts
      response = await hotRequest.call(HOT, 'near:signIn', {});
    } else {
      // console.log("Using Browser Extension flow (signIn)");
      // Для расширения браузера используем старый API (ваш рабочий код)
      response = await hotRequest.call(HOT, 'signIn', {
        contractId: import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 'easy-proxy.near',
        methodNames: ['nft_mint_proxy'],
      });
    }

    // console.log("SignIn response:", response);

    if (response && response.accountId) {
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      return {
        isConnected: true,
        accountId: response.accountId,
        // Не возвращаем wallet
      };
    }
    // console.warn('SignIn response does not contain accountId:', response);
    return null;
  } catch (error: any) {
    console.error('Wallet connection error:', error);
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // Обработка специфичной ошибки SDK для fallback сценариев (Telegram)
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    // console.log("Attempting to disconnect wallet...");

    // Повторяем проверки для HOT
    if (!HOT || typeof HOT !== 'object') {
       console.error("HOT Wallet SDK instance is not available or not an object for disconnect.");
       // Очищаем localStorage даже если HOT недоступен
       localStorage.removeItem('near_wallet_connected');
       localStorage.removeItem('near_wallet_account_id');
       return;
    }

    const hotRequest = (HOT as any).request;
    if (typeof hotRequest !== 'function') {
       console.error("HOT Wallet SDK instance does not have a callable 'request' method for disconnect.", { HOT });
       // Очищаем localStorage даже если HOT недоступен
       localStorage.removeItem('near_wallet_connected');
       localStorage.removeItem('near_wallet_account_id');
       return;
    }

    const isTelegramWebApp = isRunningInTelegramWebApp();

    if (isTelegramWebApp) {
      // console.log("Using Telegram WebApp flow (near:signOut)");
      // Для Telegram WebApp используем методы с префиксом near:
      await hotRequest.call(HOT, 'near:signOut', {});
    } else {
      // console.log("Using Browser Extension flow (signOut)");
      // Для расширения браузера используем старый API
      await hotRequest.call(HOT, 'signOut', {});
    }

    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
  } catch (error) {
    console.error('Wallet disconnection error:', error);
    // Даже если ошибка, очищаем localStorage, чтобы UI не застрял
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
  }
}

export async function getConnectedWallet(): Promise<WalletInfo> {
  try {
    const isConnected = localStorage.getItem('near_wallet_connected') === 'true';
    const accountId = localStorage.getItem('near_wallet_account_id');
    
    if (isConnected && accountId) {
      return {
        isConnected: true,
        accountId,
        // Не возвращаем wallet
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
    const isConnected = localStorage.getItem('near_wallet_connected') === 'true';
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    // console.log("Attempting to sign transaction...");
    // console.log("Transaction params:", params);

    // Повторяем проверки для HOT
    if (!HOT || typeof HOT !== 'object') {
       throw new Error("HOT Wallet SDK instance is not available or not an object for transaction signing.");
    }

    const hotRequest = (HOT as any).request;
    if (typeof hotRequest !== 'function') {
       throw new Error("HOT Wallet SDK instance does not have a callable 'request' method for transaction signing.");
    }

    const isTelegramWebApp = isRunningInTelegramWebApp();
    let result: any;

    if (isTelegramWebApp) {
      // console.log("Using Telegram WebApp flow (near:signAndSendTransactions)");
      // Для Telegram WebApp используем методы с префиксом near: и структуру transactions
      const sdkResult = await hotRequest.call(HOT, 'near:signAndSendTransactions', {
        transactions: [
          {
            receiverId: params.receiverId,
            actions: params.actions,
            // signerId SDK может подставить автоматически
          }
        ]
      });
      // console.log("Transaction result from SDK:", sdkResult);

      // Обработка результата согласно структуре из SDK (transactions[0])
      const transactionResult = sdkResult?.transactions?.[0];
      if (!transactionResult) {
          throw new Error('Transaction result is empty or malformed');
      }
      result = transactionResult;

    } else {
      // console.log("Using Browser Extension flow (signAndSendTransaction)");
      // Для расширения браузера используем старый API
      result = await hotRequest.call(HOT, 'signAndSendTransaction', params);
      // console.log("Transaction result from SDK:", result);
    }

    return {
      success: true,
      transactionHash: result?.transaction?.hash || result?.transaction_outcome?.id,
      transaction_outcome: result?.transaction_outcome,
      transaction: result?.transaction,
      result: result,
    };

  } catch (error: any) {
    console.error('Transaction signing error:', error);
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // Обработка специфичной ошибки SDK
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during transaction signing',
    };
  }
}
