"""Solana Devnet Service - Native SOL transfers with no amount limits"""

import logging
from typing import Dict, Any, Optional
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
import base58
import time

logger = logging.getLogger(__name__)

# Lamports per SOL (1 SOL = 1 billion lamports)
LAMPORTS_PER_SOL = 1_000_000_000


class SolanaService:
    """Solana RPC client for devnet SOL transfers."""

    def __init__(self, rpc_endpoint: str, private_key: str = None, network: str = "devnet"):
        """
        Initialize Solana service.

        Args:
            rpc_endpoint: Solana RPC endpoint URL
            private_key: Base58-encoded private key for the sender wallet
            network: Network name (devnet, testnet, mainnet-beta)
        """
        self.rpc_endpoint = rpc_endpoint
        self.network = network
        self.client = Client(rpc_endpoint)
        self.keypair: Optional[Keypair] = None

        if private_key:
            try:
                self.keypair = Keypair.from_base58_string(private_key)
                logger.info(f"Solana wallet loaded: {self.keypair.pubkey()}")
            except Exception as e:
                logger.error(f"Failed to load Solana keypair: {e}")
                raise ValueError(f"Invalid Solana private key: {e}")

    def get_explorer_url(self, signature: str) -> str:
        """Get Solana Explorer URL for a transaction."""
        cluster_param = f"?cluster={self.network}" if self.network != "mainnet-beta" else ""
        return f"https://explorer.solana.com/tx/{signature}{cluster_param}"

    def airdrop(self, pubkey: str = None, amount_sol: float = 1.0) -> Dict[str, Any]:
        """
        Request SOL from devnet faucet.

        Args:
            pubkey: Recipient public key (defaults to service wallet)
            amount_sol: Amount of SOL to request (max 2 SOL per request on devnet)

        Returns:
            Dict with signature, amount, and explorer URL
        """
        if pubkey is None:
            if self.keypair is None:
                raise ValueError("No wallet configured and no pubkey provided")
            pubkey = str(self.keypair.pubkey())

        try:
            target = Pubkey.from_string(pubkey)
            lamports = int(amount_sol * LAMPORTS_PER_SOL)

            # Request airdrop
            response = self.client.request_airdrop(target, lamports)
            signature = str(response.value)

            # Wait for confirmation
            self.client.confirm_transaction(signature, commitment=Confirmed)

            logger.info(f"Airdrop successful: {amount_sol} SOL to {pubkey}")

            return {
                "success": True,
                "signature": signature,
                "amount_sol": amount_sol,
                "amount_lamports": lamports,
                "recipient": pubkey,
                "explorer_url": self.get_explorer_url(signature)
            }
        except Exception as e:
            logger.error(f"Airdrop failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "recipient": pubkey,
                "amount_sol": amount_sol
            }

    def transfer(self, to_pubkey: str, amount_sol: float, memo: str = None) -> Dict[str, Any]:
        """
        Transfer SOL to destination address.

        Args:
            to_pubkey: Recipient's public key (base58 string)
            amount_sol: Amount of SOL to transfer
            memo: Optional memo/reference for the transfer

        Returns:
            Dict with signature, amounts, addresses, and explorer URL
        """
        if self.keypair is None:
            raise ValueError("No sender wallet configured")

        start_time = time.time()

        try:
            from_pubkey = self.keypair.pubkey()
            to_key = Pubkey.from_string(to_pubkey)
            lamports = int(amount_sol * LAMPORTS_PER_SOL)

            # Get recent blockhash
            blockhash_response = self.client.get_latest_blockhash()
            recent_blockhash = blockhash_response.value.blockhash

            # Create transfer instruction
            transfer_ix = transfer(
                TransferParams(
                    from_pubkey=from_pubkey,
                    to_pubkey=to_key,
                    lamports=lamports
                )
            )

            # Build message using MessageV0 (modern API)
            msg = MessageV0.try_compile(
                payer=from_pubkey,
                instructions=[transfer_ix],
                address_lookup_table_accounts=[],
                recent_blockhash=recent_blockhash
            )

            # Create and sign versioned transaction
            tx = VersionedTransaction(msg, [self.keypair])

            # Send raw transaction
            response = self.client.send_raw_transaction(bytes(tx))
            sig = response.value  # This is a Signature object
            signature = str(sig)

            # Wait for confirmation using the Signature object
            self.client.confirm_transaction(sig, commitment=Confirmed)

            elapsed_ms = int((time.time() - start_time) * 1000)

            logger.info(f"Transfer successful: {amount_sol} SOL to {to_pubkey} ({elapsed_ms}ms)")

            return {
                "success": True,
                "signature": signature,
                "amount_sol": amount_sol,
                "amount_lamports": lamports,
                "from": str(from_pubkey),
                "to": to_pubkey,
                "memo": memo,
                "explorer_url": self.get_explorer_url(signature),
                "confirmation": "confirmed",
                "confirmation_time_ms": elapsed_ms
            }
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Transfer failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "from": str(self.keypair.pubkey()) if self.keypair else None,
                "to": to_pubkey,
                "amount_sol": amount_sol,
                "elapsed_ms": elapsed_ms
            }

    def get_balance(self, pubkey: str = None) -> Dict[str, Any]:
        """
        Get wallet balance in SOL and lamports.

        Args:
            pubkey: Public key to check (defaults to service wallet)

        Returns:
            Dict with balance in SOL and lamports
        """
        if pubkey is None:
            if self.keypair is None:
                raise ValueError("No wallet configured and no pubkey provided")
            pubkey = str(self.keypair.pubkey())

        try:
            target = Pubkey.from_string(pubkey)
            response = self.client.get_balance(target)
            lamports = response.value
            sol = lamports / LAMPORTS_PER_SOL

            return {
                "success": True,
                "pubkey": pubkey,
                "balance_sol": sol,
                "balance_lamports": lamports
            }
        except Exception as e:
            logger.error(f"Balance check failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "pubkey": pubkey
            }

    def health_check(self) -> Dict[str, Any]:
        """
        Check RPC connectivity and wallet status.

        Returns:
            Dict with health status, slot, and wallet info
        """
        try:
            # Check RPC connectivity by getting slot
            slot_response = self.client.get_slot()
            current_slot = slot_response.value

            result = {
                "healthy": True,
                "rpc_endpoint": self.rpc_endpoint,
                "network": self.network,
                "current_slot": current_slot
            }

            # Add wallet info if configured
            if self.keypair:
                balance = self.get_balance()
                result["wallet"] = {
                    "pubkey": str(self.keypair.pubkey()),
                    "balance_sol": balance.get("balance_sol", 0) if balance.get("success") else None
                }

            return result
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "healthy": False,
                "error": str(e),
                "rpc_endpoint": self.rpc_endpoint,
                "network": self.network
            }

    def generate_keypair() -> Dict[str, str]:
        """
        Generate a new Solana keypair.

        Returns:
            Dict with public key and private key (base58 encoded)
        """
        keypair = Keypair()
        return {
            "pubkey": str(keypair.pubkey()),
            "private_key": base58.b58encode(bytes(keypair)).decode("utf-8")
        }


# Singleton instances
_solana_instance: Optional[SolanaService] = None
_solana_instance_2: Optional[SolanaService] = None


def get_solana_service() -> Optional[SolanaService]:
    """Get Solana service singleton (wallet 1 - sender)."""
    return _solana_instance


def get_solana_service_2() -> Optional[SolanaService]:
    """Get Solana service singleton for wallet 2 (receiver - for refunds)."""
    return _solana_instance_2


def init_solana_service(rpc_endpoint: str, private_key: str = None, network: str = "devnet") -> SolanaService:
    """
    Initialize the Solana service singleton.

    Args:
        rpc_endpoint: Solana RPC endpoint URL
        private_key: Base58-encoded private key
        network: Network name (devnet, testnet, mainnet-beta)

    Returns:
        Initialized SolanaService instance
    """
    global _solana_instance
    _solana_instance = SolanaService(rpc_endpoint, private_key, network)
    return _solana_instance


def init_solana_service_2(rpc_endpoint: str, private_key: str = None, network: str = "devnet") -> SolanaService:
    """
    Initialize the second Solana service singleton (wallet 2 - for refunds).

    Args:
        rpc_endpoint: Solana RPC endpoint URL
        private_key: Base58-encoded private key for wallet 2
        network: Network name (devnet, testnet, mainnet-beta)

    Returns:
        Initialized SolanaService instance for wallet 2
    """
    global _solana_instance_2
    _solana_instance_2 = SolanaService(rpc_endpoint, private_key, network)
    return _solana_instance_2
