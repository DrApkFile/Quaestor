// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ShieldPoolPayments} from "gloam/ShieldPoolPayments.sol";
import {GloamPayMemo} from "gloam/GloamPayMemo.sol";
import {IVerifier} from "gloam/interfaces/IVerifier.sol";
import {ShieldVerifierFinal} from "gloam/verifiers/final/ShieldVerifierFinal.sol";
import {ShieldIVerifierFinal} from "gloam/verifiers/final/ShieldIVerifierFinal.sol";
import {UnshieldVerifierFinal} from "gloam/verifiers/final/UnshieldVerifierFinal.sol";
import {UnshieldIVerifierFinal} from "gloam/verifiers/final/UnshieldIVerifierFinal.sol";
import {TransferVerifierFinal} from "gloam/verifiers/final/TransferVerifierFinal.sol";
import {TransferIVerifierFinal} from "gloam/verifiers/final/TransferIVerifierFinal.sol";
import {DualProofVerifier} from "gloam/verifiers/DualProofVerifier.sol";
import {KeyCheckProofs} from "gloam-script/KeyCheckProofs.sol";

contract DeployQuaestorPool is Script {
    uint256 internal constant QORECHAIN_TESTNET_EVM_CHAIN_ID = 9800;

    struct Deployed {
        address shieldVerifier;
        address dualVerifier;
        address pool;
        address memoBoard;
    }

    function run() external returns (Deployed memory deployed) {
        require(block.chainid == QORECHAIN_TESTNET_EVM_CHAIN_ID, "not QoreChain testnet (EVM chain id 9800)");
        address poseidon2 = vm.envAddress("POSEIDON2");
        require(poseidon2.code.length > 0, "POSEIDON2 has no code on this chain");
        address fusd = vm.envAddress("FUSD");
        require(fusd.code.length > 0, "FUSD has no code on this chain");
        uint128 fusdPerDeposit = uint128(vm.envUint("FUSD_PER_DEPOSIT"));
        uint128 fusdTotal = uint128(vm.envUint("FUSD_TOTAL"));
        require(fusdPerDeposit > 0 && fusdTotal >= fusdPerDeposit, "set FUSD_PER_DEPOSIT and FUSD_TOTAL (base units)");
        uint128 nativePerDeposit = uint128(vm.envOr("NATIVE_PER_DEPOSIT", uint256(0)));
        uint128 nativeTotal = uint128(vm.envOr("NATIVE_TOTAL", uint256(0)));
        require(nativePerDeposit == 0 || nativeTotal >= nativePerDeposit, "NATIVE_TOTAL must be at least NATIVE_PER_DEPOSIT");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        (address dual, address shieldI) = deployVerifiers();
        requireCeremonyKeys(dual, shieldI);
        ShieldPoolPayments pool = new ShieldPoolPayments(poseidon2, dual);
        pool.turnOnDepositLimits();
        pool.setShieldVerifier(shieldI);
        pool.setDepositLimit(fusd, fusdPerDeposit, fusdTotal);
        if (nativePerDeposit > 0) {
            pool.setDepositLimit(address(0), nativePerDeposit, nativeTotal);
        }
        pool.endSetup();
        GloamPayMemo memo = new GloamPayMemo();
        vm.stopBroadcast();

        deployed = Deployed({shieldVerifier: shieldI, dualVerifier: dual, pool: address(pool), memoBoard: address(memo)});
        console2.log("poseidon2", poseidon2);
        console2.log("shieldVerifier", shieldI);
        console2.log("dualVerifier", dual);
        console2.log("pool", address(pool));
        console2.log("memoBoard", address(memo));
        console2.log("fusd", fusd);
    }

    function deployVerifiers() internal returns (address dual, address shieldI) {
        ShieldIVerifierFinal shield = new ShieldIVerifierFinal(new ShieldVerifierFinal());
        UnshieldIVerifierFinal unshield = new UnshieldIVerifierFinal(new UnshieldVerifierFinal());
        TransferIVerifierFinal transfer = new TransferIVerifierFinal(new TransferVerifierFinal());
        dual = address(new DualProofVerifier(unshield, transfer));
        shieldI = address(shield);
    }

    function requireCeremonyKeys(address dual, address shieldI) internal view {
        (bytes memory proof, uint256[] memory pub) = KeyCheckProofs.shieldFinal();
        require(IVerifier(shieldI).verify(proof, pub), "shield verifier rejects a final-key proof");
        (proof, pub) = KeyCheckProofs.shieldDev();
        require(!IVerifier(shieldI).verify(proof, pub), "shield verifier accepts a dev-key proof");
        (proof, pub) = KeyCheckProofs.unshieldFinal();
        require(IVerifier(dual).verify(proof, pub), "unshield verifier rejects a final-key proof");
        (proof, pub) = KeyCheckProofs.unshieldDev();
        require(!IVerifier(dual).verify(proof, pub), "unshield verifier accepts a dev-key proof");
        (proof, pub) = KeyCheckProofs.transferFinal();
        require(IVerifier(dual).verify(proof, pub), "transfer verifier rejects a final-key proof");
        (proof, pub) = KeyCheckProofs.transferDev();
        require(!IVerifier(dual).verify(proof, pub), "transfer verifier accepts a dev-key proof");
    }
}
