/**
 *  @title Rock Paper Scissors Lizard Spock
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

/* This program is free software. It comes without any warranty, to
the extent permitted by applicable law. You can redistribute it
and/or modify it under the terms of the Do What The Fuck You Want
To Public License, Version 2, as published by Sam Hocevar. See
http://www.wtfpl.net/ for more details. */

pragma solidity >=0.7.0 <0.9.0;

contract RPS {
    address public j1; // The first player creating the contract.
    address public j2; // The second player.
    enum Move {Null, Rock, Paper, Scissors, Spock, Lizard} // Possible moves. Note that if the parity of the moves is the same the lower one wins, otherwise the higher one.
    bytes32 public c1Hash; // Commitment of j1.
    Move public c2; // Move of j2. Move.Null before he played.
    uint256 public stake; // Amount bet by each party.
    uint256 public constant TIMEOUT = 5 minutes; // If some party takes more than TIMEOUT to respond, the other can call TIMEOUT to win.
    uint256 public lastAction; // The time of the last action. Useful to determine if someone has timed out.

    /** @dev Constructor. Must send the amount at stake when creating the contract. Note that the move and salt must be saved.
     *  @param _c1Hash Must be equal to keccak256(abi.encodePacked(c1, salt)) where c1 is the move of j1.
     */
    constructor(bytes32 _c1Hash, address _j2) payable {
        stake = msg.value; // The stake corresponds to the amount of ethers sent.
        j1 = msg.sender;
        j2 = _j2;
        c1Hash = _c1Hash;
        lastAction = block.timestamp;
    }

    /** @dev To be called by j2 and provided stake.
     *  @param _c2 The move submitted by j2.
     */
    function play(Move _c2) external payable {
        require(c2 == Move.Null, "J2 has already played.");
        require(_c2 != Move.Null, "Invalid move.");
        require(msg.value == stake, "Incorrect stake amount.");
        require(msg.sender == j2, "Only J2 can call this function.");

        c2 = _c2;
        lastAction = block.timestamp;
    }

    /** @dev To be called by j1. Reveal the move and send the ETH to the winning party or split them.
     *  @param _c1 The move played by j1.
     *  @param _salt The salt used when submitting the commitment when the constructor was called.
     */
    function solve(Move _c1, uint256 _salt) external {
        require(_c1 != Move.Null, "Invalid move by J1.");
        require(c2 != Move.Null, "J2 has not played yet.");

        require(msg.sender == j1, "Only J1 can call this function.");
        require(keccak256(abi.encodePacked(_c1, _salt)) == c1Hash, "Invalid commitment.");

        if (win(_c1, c2)) {
            payable(j1).transfer(2 * stake);
        } else if (win(c2, _c1)) {
            payable(j2).transfer(2 * stake);
        } else {
            payable(j1).transfer(stake);
            payable(j2).transfer(stake);
        }
        stake = 0;
    }

    /** @dev Let j2 get the funds back if j1 did not play.
     */
    function j1Timeout() external {
        require(c2 != Move.Null, "J2 has not played.");
        require(block.timestamp > lastAction + TIMEOUT, "Timeout has not passed.");
        payable(j2).transfer(2 * stake);
        stake = 0;
    }

    /** @dev Let j1 take back the funds if j2 never plays.
     */
    function j2Timeout() external {
        require(c2 == Move.Null, "J2 has already played.");
        require(block.timestamp > lastAction + TIMEOUT, "Timeout has not passed.");
        payable(j1).transfer(stake);
        stake = 0;
    }

    /** @dev Is this move winning over the other.
     *  @param _c1 The first move.
     *  @param _c2 The move the first move is considered against.
     *  @return w True if c1 beats c2. False if c1 is beaten by c2 or in case of tie.
     */
    function win(Move _c1, Move _c2) public pure returns (bool w) {
        if (_c1 == _c2)
            return false; // They played the same so no winner.
        else if (_c1 == Move.Null)
            return false; // They did not play.
        else if (uint256(_c1) % 2 == uint256(_c2) % 2)
            return (_c1 < _c2);
        else
            return (_c1 > _c2);
    }
}

