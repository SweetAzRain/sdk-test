// client/src/lib/near-wallet.ts
import HOT from '@hot-wallet/sdk'; // HOT - это инстанс класса из SDK

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  // Убираем wallet из возвращаемого объекта, чтобы не передавать потенциально проблемный инстанс
}

// Функция для получения провайдера напрямую из window или из SDK
// Эта логика проверяет window.hotExtension и HOT.isInjected
// и возвращает объект с методом request.
// Это необходимо для Telegram WebApp, где HOT.request использует fallback-механизм.
function getHotProvider(): { request: (method: string, params: any) => Promise<any> } | null {
  // 1. Пробуем получить провайдер напрямую из window (стандартный способ для injected wallets)
  if (typeof window !== 'undefined' && (window as any).hotExtension) {
    const provider = (window as any).hotExtension;
    // Дополнительная проверка на наличие request
    if (typeof provider.request === 'function') {
      // console.log("Using hotExtension provider from window");
      return provider;
    } else {
      // console.warn("window.hotExtension found but does not have a request method:", provider);
    }
  }

  // 2. Если window.hotExtension нет или он неправильный, проверяем HOT.isInjected
  // HOT SDK сам обрабатывает isInjected и использует window.hotExtension или fallback
  if (HOT && (HOT as any).isInjected !== undefined) { // Проверяем существование свойства
    // HOT.isInjected true/false означает, что SDK может обрабатывать запросы
    // console.log("Using HOT SDK instance (isInjected=" + HOT.isInjected + ")");
    // HOT сам является объектом с методом request
    return HOT; 
  }

  // 3. Если ничего не найдено, но HOT существует и у него есть request (на случай, если isInjected не определено точно)
  // Это может помочь в некоторых сценариях fallback внутри SDK
  if (HOT && typeof (HOT as any).request === 'function') {
    // console.log("Using HOT SDK instance directly (request method found)");
    return HOT;
  }

  // 4. Если ничего не найдено
  // console.error('HOT Wallet provider not found. Is the extension installed and enabled?');
  // console.log("HOT object:", HOT);
  // console.log("HOT.isInjected:", HOT?.isInjected);
  // console.log("window.hotExtension:", typeof window !== 'undefined' ? (window as any).hotExtension : 'window is undefined');
  return null;
}

// Проверяем, запущено ли приложение внутри Telegram WebApp
function isRunningInTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const isTelegramWebApp = isRunningInTelegramWebApp();
    let response: any;

    if (isTelegramWebApp) {
      // Для Telegram WebApp используем методы с префиксом near:, как в setupHotWallet.ts
      // console.log("Connecting via Telegram WebApp");
      const provider = getHotProvider();
      if (!provider) {
        console.error('HOT Wallet provider is not available for Telegram WebApp connection.');
        return null;
      }
      // setupHotWallet.ts показывает: if (HOT.isInjected) return [await HOT.request("near:signIn", {})];
      response = await provider.request('near:signIn', {});
    } else {
      // Для расширения браузера используем старый API (ваш рабочий код)
      // console.log("Connecting via browser extension");
      const provider = getHotProvider();
      if (!provider) {
        console.error('HOT Wallet provider is not available for browser extension connection.');
        return null;
      }
      response = await provider.request('signIn', {
        contractId: import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 'easy-proxy.near',
        methodNames: ['nft_mint_proxy'],
      });
    }

    // console.log("SignIn response:", response);

    if (response && response.accountId) {
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      // Не возвращаем сам провайдер, чтобы избежать проблем с сериализацией или повторным использованием
      return {
        isConnected: true,
        accountId: response.accountId,
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
    // Проверим, не является ли это ошибкой из fallback-механизма SDK (iframe/polling)
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const isTelegramWebApp = isRunningInTelegramWebApp();
    
    if (isTelegramWebApp) {
      // Для Telegram WebApp используем методы с префиксом near:, как в setupHotWallet.ts
      // console.log("Disconnecting via Telegram WebApp");
      const provider = getHotProvider();
      if (!provider) {
        console.warn('Cannot disconnect: HOT Wallet provider is not available for Telegram WebApp.');
        // Очищаем localStorage даже если провайдер недоступен
        localStorage.removeItem('near_wallet_connected');
        localStorage.removeItem('near_wallet_account_id');
        return;
      }
      // setupHotWallet.ts показывает: if (HOT.isInjected) HOT.request("near:signOut", {});
      await provider.request('near:signOut', {});
    } else {
      // Для расширения браузера используем старый API (ваш рабочий код)
      // console.log("Disconnecting via browser extension");
      const provider = getHotProvider();
      if (!provider) {
        console.warn('Cannot disconnect: HOT Wallet provider is not available for browser extension.');
        // Очищаем localStorage даже если провайдер недоступен
        localStorage.removeItem('near_wallet_connected');
        localStorage.removeItem('near_wallet_account_id');
        return;
      }
      await provider.request('signOut', {});
    }

    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
  } catch (error) {
    console.error('Wallet disconnection error:', error);
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
    console.error('Error checking wallet status:', error);
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

    const isTelegramWebApp = isRunningInTelegramWebApp();
    let result: any;

    if (isTelegramWebApp) {
      // Для Telegram WebApp используем методы с префиксом near: и структуру transactions, как в setupHotWallet.ts
      // console.log("Signing transaction via Telegram WebApp");
      // console.log("Transaction params:", params);
      const provider = getHotProvider();
      if (!provider) {
        throw new Error('HOT Wallet provider is not available for Telegram WebApp transaction signing');
      }
      
      // setupHotWallet.ts показывает:
      // const { transactions } = await HOT.request("near:signAndSendTransactions", {
      //   transactions: [{ actions: params.actions, receiverId, signerId: params.signerId }],
      // });
      const sdkResult = await provider.request('near:signAndSendTransactions', {
        transactions: [
          {
            receiverId: params.receiverId,
            actions: params.actions,
            // signerId SDK может подставить автоматически
          }
        ]
      });
      // console.log("Transaction result:", sdkResult);

      // Обработка результата согласно структуре из SDK (transactions[0])
      const transactionResult = sdkResult?.transactions?.[0];
      if (!transactionResult) {
          throw new Error('Transaction result is empty or malformed');
      }
      result = transactionResult;

    } else {
      // Для расширения браузера используем старый API (ваш рабочий код)
      // console.log("Signing transaction via browser extension");
      // console.log("Transaction params:", params);
      const provider = getHotProvider();
      if (!provider) {
        throw new Error('HOT Wallet provider is not available for browser extension transaction signing');
      }
      result = await provider.request('signAndSendTransaction', params);
      // console.log("Transaction result:", result);
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
