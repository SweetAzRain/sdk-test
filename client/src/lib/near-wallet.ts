// client/src/lib/near-wallet.ts
// КОД ИЗ worknahui.txt БЕЗ ИЗМЕНЕНИЙ ДЛЯ БРАУЗЕРА + ПОДДЕРЖКА TELEGRAM WEBAPP
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

// === ДОБАВЛЕНО: Функция для определения контекста выполнения ===
function isRunningInTelegramWebApp(): boolean {
  // Безопасная проверка, как в коде библиотеки из Pasted_Text_1754232010153.txt
  if (typeof window === "undefined") return false;
  const win = window as any;
  // Проверяем, как в библиотеке: typeof window.Telegram?.WebApp !== "undefined"
  // или просто наличие объекта
  return !!(win.Telegram && win.Telegram.WebApp);
}

export async function connectWallet(): Promise<WalletInfo | null> {
  try {
    const wallet = getWalletInstance();
    
    // === ДОБАВЛЕНО: Проверка контекста ===
    if (isRunningInTelegramWebApp()) {
      // === ДОБАВЛЕНО: Логика для Telegram WebApp ===
      // Согласно коду библиотеки (Pasted_Text_1754232010153.txt, строка ~150+), 
      // внутри метода request класса HOT есть логика для Telegram WebApp.
      // Она использует методы с префиксом 'near:'.
      // setupHotWallet.ts также показывает использование 'near:signIn'.
      console.log("HOT Wallet: Connecting via Telegram WebApp (near:signIn)");
      // Вызываем 'near:signIn' без параметров contractId/methodNames, как в setupHotWallet.ts
      const response = await wallet.request('near:signIn', {});
      
      if (response && response.accountId) {
        localStorage.setItem('near_wallet_connected', 'true');
        localStorage.setItem('near_wallet_account_id', response.accountId);
        return {
          isConnected: true,
          accountId: response.accountId,
          wallet, // Передаем wallet, как в оригинале
        };
      }
      return null;
    } else {
      // === БЕЗ ИЗМЕНЕНИЙ: Логика для браузерного расширения из worknahui.txt ===
      console.log("HOT Wallet: Connecting via browser extension (signIn)");
      const response = await wallet.request('signIn', {
        contractId: import.meta.env.VITE_NFT_CONTRACT_ADDRESS || 'easy-proxy.near',
        methodNames: ['nft_mint_proxy'],
      });

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
    }
  } catch (error: any) {
    console.error('Wallet connection error:', error);
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // === ДОБАВЛЕНО: Обработка специфичной ошибки из библиотеки ===
    // В коде библиотеки (Pasted_Text_1754232010153.txt, строка ~7) определен класс RequestFailed
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return null;
  }
}

export async function disconnectWallet(): Promise<void> {
  try {
    const wallet = getWalletInstance();
    
    // === ДОБАВЛЕНО: Проверка контекста ===
    if (isRunningInTelegramWebApp()) {
      // === ДОБАВЛЕНО: Логика для Telegram WebApp ===
      console.log("HOT Wallet: Disconnecting via Telegram WebApp (near:signOut)");
      // setupHotWallet.ts показывает использование 'near:signOut'.
      await wallet.request('near:signOut', {});
    } else {
      // === БЕЗ ИЗМЕНЕНИЙ: Логика для браузерного расширения из worknahui.txt ===
      console.log("HOT Wallet: Disconnecting via browser extension (signOut)");
      await wallet.request('signOut', {});
    }
    
    localStorage.removeItem('near_wallet_connected');
    localStorage.removeItem('near_wallet_account_id');
    walletInstance = null;
  } catch (error) {
    console.error('Wallet disconnection error:', error);
    // Очищаем localStorage даже если ошибка, чтобы UI не застрял
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
    
    // === ДОБАВЛЕНО: Проверка контекста ===
    if (isRunningInTelegramWebApp()) {
      // === ДОБАВЛЕНО: Логика для Telegram WebApp ===
      console.log("HOT Wallet: Signing transaction via Telegram WebApp (near:signAndSendTransactions)");
      // setupHotWallet.ts показывает использование 'near:signAndSendTransactions'
      // и структуры { transactions: [...] }.
      const sdkResult = await walletInfo.wallet.request('near:signAndSendTransactions', {
        transactions: [
          {
            receiverId: params.receiverId,
            actions: params.actions,
            // signerId SDK может подставить автоматически
          }
        ]
      });
      // Обработка результата согласно структуре из SDK (transactions[0]), как в setupHotWallet.ts
      const transactionResult = sdkResult?.transactions?.[0];
      if (!transactionResult) {
          throw new Error('Transaction result is empty or malformed for Telegram WebApp');
      }

      return {
        success: true,
        transactionHash: transactionResult.transaction?.hash || transactionResult.transaction_outcome?.id,
        transaction_outcome: transactionResult.transaction_outcome,
        transaction: transactionResult.transaction,
        result: transactionResult, // Возвращаем обработанный результат
      };
    } else {
      // === БЕЗ ИЗМЕНЕНИЙ: Логика для браузерного расширения из worknahui.txt ===
      console.log("HOT Wallet: Signing transaction via browser extension (signAndSendTransaction)");
      const result = await walletInfo.wallet.request('signAndSendTransaction', params);
      
      return {
        success: true,
        transactionHash: result.transaction?.hash,
        transaction_outcome: result.transaction_outcome,
        transaction: result.transaction,
        result,
      };
    }
  } catch (error: any) {
    console.error('Transaction signing error:', error);
    if (error && error.message) {
      console.error('Error message:', error.message);
    }
    if (error && error.stack) {
      console.error('Error stack:', error.stack);
    }
    // === ДОБАВЛЕНО: Обработка специфичной ошибки из библиотеки ===
    if (error && error.name === "RequestFailed") {
       console.error("HOT SDK RequestFailed payload:", error.payload);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
