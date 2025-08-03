// client/src/lib/near-wallet.ts
import HOT from '@hot-wallet/sdk'; // HOT - это инстанс класса из SDK

interface WalletInfo {
  isConnected: boolean;
  accountId: string | null;
  // Убираем wallet из возвращаемого объекта, чтобы не передавать потенциально проблемный инстанс
}

// Функция для получения провайдера напрямую из window или из SDK
function getHotProvider(): { request: (method: string, params: any) => Promise<any> } | null {
  // 1. Пробуем получить провайдер напрямую из window (стандартный способ для injected wallets)
  if (typeof window !== 'undefined' && (window as any).hotExtension) {
    const provider = (window as any).hotExtension;
    // Дополнительная проверка на наличие request
    if (typeof provider.request === 'function') {
      console.log("Using hotExtension provider from window");
      return provider;
    } else {
      console.warn("window.hotExtension found but does not have a request method:", provider);
    }
  }

  // 2. Если window.hotExtension нет или он неправильный, проверяем HOT.isInjected
  // Согласно коду SDK, HOT.request внутри проверяет isInjected и использует window.hotExtension или fallback
  if (HOT && HOT.isInjected) {
    // HOT.isInjected true означает, что SDK может обрабатывать запросы через injected request или fallback
    console.log("Using HOT SDK instance (isInjected=true)");
    // HOT сам является объектом с методом request, как показано в index.ts SDK
    return HOT; 
  }

  // 3. Если ничего не найдено
  console.error('HOT Wallet provider not found. Is the extension installed and enabled?');
  console.log("HOT object:", HOT);
  console.log("HOT.isInjected:", HOT?.isInjected);
  console.log("window.hotExtension:", typeof window !== 'undefined' ? (window as any).hotExtension : 'window is undefined');
  return null;
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const provider = getHotProvider();
    
    if (!provider) {
      // Если провайдер не найден, возвращаем null или бросаем ошибку
      return null;
    }

    // Используем правильный метод с префиксом 'near:' из SDK
    // setupHotWallet.ts показывает, что 'near:signIn' внутри SDK может не требовать параметров contractId/methodNames напрямую в request
    // Эти параметры обрабатываются позже или внутри SDK
    console.log("Calling provider.request('near:signIn', {})");
    const response = await provider.request('near:signIn', {});
    console.log("SignIn response:", response);
    
    if (response && response.accountId) {
      localStorage.setItem('near_wallet_connected', 'true');
      localStorage.setItem('near_wallet_account_id', response.accountId);
      // Не возвращаем сам провайдер, чтобы избежать проблем с сериализацией или повторным использованием
      return {
        isConnected: true,
        accountId: response.accountId,
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
    // Проверим, не является ли это ошибкой из fallback-механизма SDK (iframe/polling)
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const provider = getHotProvider();
    if (!provider) {
      console.warn('Cannot disconnect: HOT Wallet provider is not available.');
      // Очищаем localStorage даже если провайдер недоступен, чтобы сбросить состояние UI
      localStorage.removeItem('near_wallet_connected');
      localStorage.removeItem('near_wallet_account_id');
      return;
    }

    // Используем правильный метод с префиксом из SDK
    console.log("Calling provider.request('near:signOut', {})");
    await provider.request('near:signOut', {});
    
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

    const provider = getHotProvider();
    if (!provider) {
      throw new Error('HOT Wallet provider is not available for transaction signing');
    }

    // Используем правильный метод с префиксом и структурой из SDK
    // setupHotWallet.ts показывает, что signAndSendTransaction внутри SDK оборачивает параметры
    // в { transactions: [...] } и вызывает 'near:signAndSendTransactions'
    console.log("Calling provider.request('near:signAndSendTransactions', ...)");
    console.log("Transaction params:", params);
    
    const result = await provider.request('near:signAndSendTransactions', {
       transactions: [
         {
           receiverId: params.receiverId,
           actions: params.actions,
           // signerId SDK может подставить автоматически
         }
       ]
    });
    console.log("Transaction result:", result);

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
