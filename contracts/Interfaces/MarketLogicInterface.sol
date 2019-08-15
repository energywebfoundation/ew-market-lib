pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

interface MarketLogicInterface {
    function getSupply(uint _supplyId) external view returns (
        uint _assetId,
        uint _price,
        uint _currency,
        uint _availableWh,
        uint _startTime,
        uint _endTime,
        uint _matchedPower
    );
}
