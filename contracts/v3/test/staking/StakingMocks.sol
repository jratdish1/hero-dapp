// SPDX-License-Identifier: MIT
// HERO V3 staking test mocks. Owner: VETS (jratdish1). Test-only.
pragma solidity 0.8.26;

contract MockERC20 {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    uint256 public feeBps; // 0 = plain ERC20
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 _feeBps) {
        feeBps = _feeBps;
    }

    function mint(address to, uint256 amt) external {
        totalSupply += amt;
        balanceOf[to] += amt;
        emit Transfer(address(0), to, amt);
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        emit Approval(msg.sender, s, a);
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        _move(msg.sender, to, a);
        return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        uint256 al = allowance[f][msg.sender];
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        _move(f, to, a);
        return true;
    }

    function _move(address f, address to, uint256 a) internal {
        balanceOf[f] -= a;
        uint256 fee = (a * feeBps) / 10_000;
        balanceOf[to] += a - fee;
        totalSupply -= fee; // burned
        emit Transfer(f, to, a - fee);
    }
}
