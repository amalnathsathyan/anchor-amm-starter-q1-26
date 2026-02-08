import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

describe("anchor-amm", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const user = provider.wallet.payer;
  const connection = provider.connection;

  // mints
  let mint_x: PublicKey;
  let mint_y: PublicKey;
  let lp_mint: PublicKey;
  // config
  let seeds: anchor.BN;
  let config: PublicKey;
  let config_bump: number;
  // user ATA
  let user_x_ata: PublicKey;
  let user_y_ata: PublicKey;
  let user_lp_ata: PublicKey;
  // vaults
  let vault_x: PublicKey;
  let vault_y: PublicKey;

  before("Creating Mints and PDAs", async () => {
    // derive the address for config
    seeds = new anchor.BN(1111);
    [config, config_bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seeds.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    console.log("Config Address", config);

    // create Mint accounts: X, Y and Lp_mint
    mint_x = await createMint(connection, user, user.publicKey, null, 6);
    console.log("Mint X created: ", mint_x);

    mint_y = await createMint(connection, user, user.publicKey, null, 6);
    console.log("Mint Y created: ", mint_y);

    [lp_mint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), config.toBuffer()],
      program.programId
    );
    console.log("lp_mint created: ", lp_mint);

    // create and mint user ATA for x, y mints
    user_x_ata = await createAssociatedTokenAccount(
      connection,
      user,
      mint_x,
      user.publicKey
    );
    console.log("Created user ata for mint X ", user_x_ata);
    mintTo(connection, user, mint_x, user_x_ata, user, 1000000);
    console.log("Minted mint_x to user_x_ata");

    user_y_ata = await createAssociatedTokenAccount(
      connection,
      user,
      mint_y,
      user.publicKey
    );
    console.log("Created user ata for mint Y ", user_y_ata);
    mintTo(connection, user, mint_y, user_y_ata, user, 1000000);
    console.log("Minted mint_y to user_y_ata");

    user_lp_ata = getAssociatedTokenAddressSync(lp_mint, user.publicKey);

    // create the vaults : X and Y
    vault_x = getAssociatedTokenAddressSync(mint_x, config, true);
    console.log("Vault X: ", vault_x);
    vault_y = getAssociatedTokenAddressSync(mint_y, config, true);
    console.log("Vault Y: ", vault_y);
  });

  const program = anchor.workspace.anchor_amm_q4_25 as Program<AnchorAmmQ425>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initialize(seeds, 200, user.publicKey)
      .accounts({
        initializer: user.publicKey,
        mintX: mint_x,
        mintY: mint_y,
      })
      .rpc();
    console.log("Initialized config", tx);
  });

  it("Deposit to pool", async () => {
    const tx = await program.methods
      .deposit(new anchor.BN(8000), new anchor.BN(10000), new anchor.BN(50000))
      .accounts({
        user: user.publicKey,
        mintX: mint_x,
        mintY: mint_y,
        mintLp: lp_mint,
        config: config,
        vaultX: vault_x,
        vaultY: vault_y,
      })
      .rpc();
    console.log("Deposit tx", tx);
    let user_lp_mint_ata = await getAccount(connection, user_lp_ata);
    console.log("", user_lp_mint_ata.amount);
    const get_vault_x = await getAccount(connection, vault_x);
    const get_vault_y = await getAccount(connection, vault_y);
    console.log(
      `Vault X : ${get_vault_x.amount}, Vault Y: ${get_vault_y.amount}`
    );
  });

  it("Swap", async () => {
    const tx = await program.methods
      .swap(true, new anchor.BN(1000), new anchor.BN(4422))
      .accounts({
        swapper: user.publicKey,
        mintX: mint_x,
        mintY: mint_y,
        config: config,
        vaultX: vault_x,
        vaultY: vault_y,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Swap tx ", tx);
    const get_vault_x = await getAccount(connection, vault_x);
    const get_vault_y = await getAccount(connection, vault_y);
    console.log(
      `Vault X : ${get_vault_x.amount}, Vault Y: ${get_vault_y.amount}`
    );
  });

  it("Withdraw complete !", async () => {
    const tx = await program.methods
      .withdraw(new anchor.BN(5000), new anchor.BN(9166), new anchor.BN(37981))
      .accounts({
        withdrawer: user.publicKey,
        mintX: mint_x,
        mintY: mint_y,
        config: config,
        vaultX: vault_x,
        vaultY: vault_y,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Withdraw tx ", tx);
    const get_vault_x = await getAccount(connection, vault_x);
    const get_vault_y = await getAccount(connection, vault_y);
    console.log(
      `Vault X : ${get_vault_x.amount}, Vault Y: ${get_vault_y.amount}`
    );
  });
});