pragma solidity 0.8.24;
import {Script} from "forge-std/Script.sol";
import {Books} from "../src/Books.sol";
contract DeployBooks is Script {
    function run() external returns (Books ledger) { vm.startBroadcast(); ledger = new Books(); vm.stopBroadcast(); }
}
