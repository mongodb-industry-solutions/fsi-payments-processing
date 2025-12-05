"""Circle API Service - USDC transfers via Developer-Controlled Wallets"""

import logging
import uuid
import base64
from typing import Dict, Any, Optional

import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key

logger = logging.getLogger(__name__)

CIRCLE_API_BASE = "https://api.circle.com/v1/w3s"


class CircleService:
    """Circle API client for USDC transfers."""

    def __init__(
        self,
        api_key: str,
        entity_secret: str,
        source_wallet_id: str,
        usdc_token_id: str = "36b6931a-873a-56a8-8a27-b706b17104ee"
    ):
        self.api_key = api_key
        self.entity_secret = entity_secret
        self.source_wallet_id = source_wallet_id
        self.usdc_token_id = usdc_token_id
        self._public_key: Optional[str] = None

    def _get_ciphertext(self) -> str:
        """Generate fresh entity secret ciphertext (required per API call)."""
        if not self._public_key:
            resp = requests.get(
                f"{CIRCLE_API_BASE}/config/entity/publicKey",
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            resp.raise_for_status()
            self._public_key = resp.json()["data"]["publicKey"]

        key = load_pem_public_key(self._public_key.encode())
        encrypted = key.encrypt(
            bytes.fromhex(self.entity_secret),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return base64.b64encode(encrypted).decode()

    def transfer(
        self,
        destination: str,
        amount: str = "1",
        reference: Optional[str] = None,
        source_wallet_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer USDC to destination address.

        Args:
            destination: Wallet address or ID
            amount: USDC amount (default: "1")
            reference: Payment reference (max 40 chars)
            source_wallet_id: Source wallet ID (defaults to configured source)
        """
        wallet_id = source_wallet_id or self.source_wallet_id

        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "entitySecretCiphertext": self._get_ciphertext(),
            "walletId": wallet_id,
            "tokenId": self.usdc_token_id,
            "destinationAddress": destination,
            "amounts": [amount],
            "feeLevel": "LOW"
        }

        if reference:
            payload["refId"] = reference[:40]

        logger.info(f"Circle transfer: {amount} USDC from {wallet_id[:8]}... to {destination[:20]}...")

        resp = requests.post(
            f"{CIRCLE_API_BASE}/developer/transactions/transfer",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json=payload
        )

        return {
            "success": resp.status_code in [200, 201],
            "status_code": resp.status_code,
            "data": resp.json()
        }

    def transfer_by_address(
        self,
        source_address: str,
        destination_address: str,
        amount: str = "1",
        reference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer USDC using wallet addresses instead of IDs.

        Args:
            source_address: Source wallet blockchain address
            destination_address: Destination wallet blockchain address
            amount: USDC amount (default: "1")
            reference: Payment reference (max 40 chars)
        """
        # Find source wallet ID from address
        source_wallet = self.get_wallet_by_address(source_address)
        if not source_wallet:
            return {
                "success": False,
                "error": f"Source wallet not found for address: {source_address}"
            }

        source_wallet_id = source_wallet.get("id")

        return self.transfer(
            destination=destination_address,
            amount=amount,
            reference=reference,
            source_wallet_id=source_wallet_id
        )

    def get_native_token_id(self, wallet_id: Optional[str] = None) -> Optional[str]:
        """Get native token ID for POL transfers."""
        wallet_id = wallet_id or self.source_wallet_id
        balance_data = self.get_balance(wallet_id)
        token_balances = balance_data.get("data", {}).get("tokenBalances", [])

        for token_entry in token_balances:
            token_info = token_entry.get("token", {})
            if token_info.get("isNative", False):
                return token_info.get("id")
        return None

    def transfer_native(
        self,
        destination: str,
        amount: str,
        source_wallet_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transfer native POL tokens to destination address.

        Args:
            destination: Destination wallet address
            amount: POL amount
            source_wallet_id: Source wallet ID (defaults to configured source)
        """
        wallet_id = source_wallet_id or self.source_wallet_id

        # Get native token ID
        native_token_id = self.get_native_token_id(wallet_id)
        if not native_token_id:
            return {
                "success": False,
                "error": "Could not find native token ID"
            }

        payload = {
            "idempotencyKey": str(uuid.uuid4()),
            "entitySecretCiphertext": self._get_ciphertext(),
            "walletId": wallet_id,
            "tokenId": native_token_id,
            "destinationAddress": destination,
            "amounts": [amount],
            "feeLevel": "LOW"
        }

        logger.info(f"Circle transfer: {amount} POL from {wallet_id[:8]}... to {destination[:20]}...")

        resp = requests.post(
            f"{CIRCLE_API_BASE}/developer/transactions/transfer",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json=payload
        )

        return {
            "success": resp.status_code in [200, 201],
            "status_code": resp.status_code,
            "data": resp.json()
        }

    def transfer_native_by_address(
        self,
        source_address: str,
        destination_address: str,
        amount: str
    ) -> Dict[str, Any]:
        """
        Transfer native POL using wallet addresses.

        Args:
            source_address: Source wallet blockchain address
            destination_address: Destination wallet blockchain address
            amount: POL amount
        """
        source_wallet = self.get_wallet_by_address(source_address)
        if not source_wallet:
            return {
                "success": False,
                "error": f"Source wallet not found for address: {source_address}"
            }

        return self.transfer_native(
            destination=destination_address,
            amount=amount,
            source_wallet_id=source_wallet.get("id")
        )

    def get_balance(self, wallet_id: Optional[str] = None) -> Dict[str, Any]:
        """Get wallet balance."""
        wallet_id = wallet_id or self.source_wallet_id
        resp = requests.get(
            f"{CIRCLE_API_BASE}/wallets/{wallet_id}/balances",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return resp.json()

    def list_wallets(self) -> Dict[str, Any]:
        """List all wallets in the wallet set."""
        resp = requests.get(
            f"{CIRCLE_API_BASE}/wallets",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return resp.json()

    def get_wallet_by_address(self, address: str) -> Optional[Dict[str, Any]]:
        """Find wallet by blockchain address."""
        wallets_resp = self.list_wallets()
        wallets = wallets_resp.get("data", {}).get("wallets", [])
        for wallet in wallets:
            if wallet.get("address", "").lower() == address.lower():
                return wallet
        return None

    def get_balance_by_address(self, address: str) -> Optional[Dict[str, Any]]:
        """Get balance for a wallet by its blockchain address."""
        wallet = self.get_wallet_by_address(address)
        if wallet:
            wallet_id = wallet.get("id")
            balance = self.get_balance(wallet_id)
            return {
                "wallet_id": wallet_id,
                "wallet_address": address,
                "balance_data": balance
            }
        return None

    def get_wallet_address(self, wallet_id: Optional[str] = None) -> Optional[str]:
        """Get blockchain address for wallet."""
        wallet_id = wallet_id or self.source_wallet_id
        resp = requests.get(
            f"{CIRCLE_API_BASE}/wallets/{wallet_id}",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        if resp.status_code == 200:
            return resp.json().get("data", {}).get("wallet", {}).get("address")
        return None

    def fund_gas(self, address: Optional[str] = None) -> Dict[str, Any]:
        """
        Request native tokens (POL) for gas from Circle faucet.

        Only works on testnet. Call before transfer if gas is low.
        Rate limit: Similar to USDC faucet.
        """
        if not address:
            address = self.get_wallet_address()
            if not address:
                return {"success": False, "error": "Could not get wallet address"}

        resp = requests.post(
            "https://api.circle.com/v1/faucet/drips",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "address": address,
                "blockchain": "MATIC-AMOY",
                "native": True,
                "usdc": False,
                "eurc": False
            }
        )

        if resp.status_code == 204:
            return {"success": True, "message": "POL gas tokens requested (may take a few seconds)", "address": address}
        else:
            error_msg = resp.json().get("message", "Faucet request failed") if resp.text else "Faucet request failed"
            return {"success": False, "error": error_msg, "status_code": resp.status_code}

    def fund_usdc(self, address: Optional[str] = None) -> Dict[str, Any]:
        """
        Request testnet USDC from Circle faucet.

        Rate limit: 1 USDC per hour per address.
        Only works on testnet (MATIC-AMOY).
        """
        if not address:
            address = self.get_wallet_address()
            if not address:
                return {"success": False, "error": "Could not get wallet address"}

        resp = requests.post(
            "https://api.circle.com/v1/faucet/drips",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "address": address,
                "blockchain": "MATIC-AMOY",
                "native": False,
                "usdc": True,
                "eurc": False
            }
        )

        if resp.status_code == 204:
            return {"success": True, "message": "1 USDC requested (may take a few seconds)"}
        else:
            error_msg = resp.json().get("message", "Faucet request failed") if resp.text else "Faucet request failed"
            return {"success": False, "error": error_msg, "status_code": resp.status_code}

    def health_check(self) -> bool:
        """Check Circle API connectivity."""
        if not self.api_key:
            return False
        try:
            resp = requests.get(
                f"{CIRCLE_API_BASE}/config/entity",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5
            )
            return resp.status_code == 200
        except Exception:
            return False


# Singleton
_instance: Optional[CircleService] = None


def get_circle_service() -> CircleService:
    """Get Circle service singleton (loads config from settings)."""
    global _instance
    if _instance is None:
        from config.settings import get_settings
        s = get_settings()
        _instance = CircleService(
            api_key=s.circle_api_key,
            entity_secret=s.circle_entity_secret,
            source_wallet_id=s.circle_source_wallet_id,
            usdc_token_id=s.circle_usdc_token_id
        )
    return _instance
