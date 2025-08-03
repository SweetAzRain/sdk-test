// client/src/lib/near.ts
interface MintParams {
  title: string;
  description: string;
  media: string;
  reference: string;
}

interface MintResult {
  tokenId: string;
  transactionHash: string;
}

export async function mintNFT(
  params: MintParams,
  signAndSendTransactionFn: (params: any) => Promise<any>
): Promise<MintResult> {
  try {
    console.log("Minting NFT with params:", params);

    if (!signAndSendTransactionFn) {
      throw new Error("Wallet not connected or signAndSendTransaction function is missing");
    }

    console.log("Calling NEAR smart contract...");


    const result = await signAndSendTransactionFn({
      receiverId: "easy-proxy.near",
      actions: [{
        type: "FunctionCall",
        params: {
          methodName: "nft_mint_proxy",
          args: {

            token_metadata: { 
              title: params.title,
              description: params.description,
              media: params.media.trim(),
              reference: params.reference.trim()
            }
          },
          gas: "300000000000000",
          deposit: "200000000000000000000000" // 0.2 NEAR in yoctoNEAR
        }
      }]
    });

    console.log("NFT minted successfully:", result);


    const transactionOutcomeId = result?.transaction_outcome?.id;
    const transactionHash = result?.transaction?.hash || transactionOutcomeId;

    if (!transactionHash) {
        console.warn("Could not extract transaction hash from result:", result);

    }

    return {
      tokenId: transactionOutcomeId || `nft_${Date.now()}`,
      transactionHash: transactionHash || `tx_${Date.now()}`
    };

  } catch (error: any) {
    console.error("NFT minting failed:", error);
    if (error.message?.includes("User rejected") ||
        error.message?.includes("cancelled") ||
        error.message?.includes("User cancelled")) {
      throw new Error("Transaction was cancelled by user");
    }
    throw error; 
  }
}
