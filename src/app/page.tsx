"use client";

import { useState, useEffect } from "react";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";
import RPS_ABI from "../../artifacts/contracts/RPS.sol/RPS.json";

enum MoveOption {
  Null = 0,
  Rock = 1,
  Paper = 2,
  Scissors = 3,
  Spock = 4,
  Lizard = 5,
}

interface Game {
  contractAddress: string;
  signature: string;
  salt: string;
}

interface Player {
  address: string;
  move: MoveOption;
  stakeAmount: string;
}

const BASE_SEPOLIA_CHAIN_ID = 84532;

const getMoveOptions = () => {
  return Object.keys(MoveOption)
    .filter((key) => isNaN(Number(key)))
    .map((key) => ({
      label: key,
      value: MoveOption[key as keyof typeof MoveOption],
    }))
    .filter((f) => f.value !== MoveOption.Null);
};

export default function Home() {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);

  const [playerOne, setPlayerOne] = useState<Player>({
    address: "",
    move: MoveOption.Null,
    stakeAmount: "0",
  });
  const [playerTwo, setPlayerTwo] = useState<Player>({
    address: "",
    move: MoveOption.Null,
    stakeAmount: "0",
  });

  const [game, setGame] = useState<Game>({
    contractAddress: "",
    signature: "",
    salt: "",
  });

  const [contract, setContract] = useState<Contract | null>();
  const [deploying, setDeploying] = useState<boolean>(false);
  const [gamePlayed, setGamePlayed] = useState<boolean>(false);
  const [gameFinished, setGameFinished] = useState<boolean>(false);

  const initWeb3 = async () => {
    if (typeof window?.ethereum !== "undefined") {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    const acc = accounts[0];
    setAccount(acc);
    if (!game.contractAddress) {
      setPlayerOne((p) => ({ ...p, address: accounts[0] }));
    }
  };

  const handleChainChanged = (chainId: string) => {
    setChainId(parseInt(chainId));
  };

  useEffect(() => {
    initWeb3();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [game.contractAddress]);

  const getShortenAddress = (add: string) =>
    `${add.slice(0, 6)}...${add.slice(-4)}`;

  const connectWallet = async () => {
    try {
      if (!web3 || typeof window?.ethereum === "undefined")
        throw new Error("Web3 not initialized");

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setAccount(accounts[0]);
      setPlayerOne((p) => ({ ...p, address: accounts[0] }));

      const chnId = await web3.eth.getChainId();
      setChainId(chnId);

      if (chnId !== BASE_SEPOLIA_CHAIN_ID) {
        alert("Connect to Goerli network");
      }
    } catch (error) {
      console.error("Error connecting wallet", error);
    }
  };

  const signMessage = async () => {
    try {
      if (!web3 || !account) throw new Error("Web3 or account not initialized");

      const message = "Sign message to confirm identity";
      const signature = await web3.eth.personal.sign(message, account, "");
      const salt = web3.utils.soliditySha3(signature)!;

      const signatureHash = web3.utils.soliditySha3(
        { type: "uint8", value: playerOne.move.toString() },
        { type: "uint256", value: salt.toString() }
      )!;

      setGame((prev) => ({
        ...prev,
        signature: signatureHash,
        salt,
      }));
    } catch (error) {
      console.error("Error signing message", error);
    }
  };

  const deployContract = async () => {
    try {
      if (!web3 || !account || !game.signature) {
        throw new Error("Web3, account or commitment not initialized");
      }

      setDeploying(true);

      const contract = new web3.eth.Contract(RPS_ABI.abi as AbiItem[]);
      const deploy = contract.deploy({
        data: RPS_ABI.bytecode,
        arguments: [game.signature, playerTwo.address],
      });

      const gas = await deploy.estimateGas();
      const deployedContract = await deploy.send({
        from: account,
        gas: Math.floor(gas * 1.2),
        value: web3.utils.toWei(playerOne.stakeAmount, "ether"),
      });

      setContract(deployedContract);
      setGame((prev) => ({
        ...prev,
        contractAddress: deployedContract.options.address,
      }));
      setDeploying(false);
    } catch (error) {
      console.error("Error deploying contract", error);
    } finally {
      setDeploying(false);
    }
  };

  const play = async () => {
    try {
      if (!contract || !account) throw new Error("Contract not deployed");

      const stakeAmount = web3?.utils.toWei(playerTwo.stakeAmount, "ether");

      await contract.methods.play(playerTwo.move).send({
        from: account,
        value: stakeAmount,
      });
      setGamePlayed(true);
    } catch (error) {
      console.error("Error playing move", error);
    }
  };

  const solve = async () => {
    try {
      if (!contract || !account) throw new Error("Contract not deployed");

      await contract.methods.solve(playerOne.move, BigInt(game.salt)).send({
        from: account,
      });

      setGameFinished(true);
    } catch (error) {
      console.error("Error", error);
    }
  };

  return (
    <div className="flex min-h-screen p-8">
      <main className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="text-black">Built on BASE_SEPOLIA chain ID=84532</div>
          <div
            onClick={connectWallet}
            className="cursor-pointer p-2 bg-blue-500 text-white rounded"
          >
            {account
              ? `Connected: ${getShortenAddress(account)}`
              : "Connect Wallet"}
          </div>
        </div>

        {account && chainId === BASE_SEPOLIA_CHAIN_ID && (
          <>
            <div
              className={`flex gap-4 flex-col ${
                contract ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <div className="flex">
                {`Player 1 (${getShortenAddress(
                  playerOne.address
                )})  game setup`}
              </div>
              <div className="flex gap-4">
                <input
                  type="string"
                  placeholder="Enter stake (ETH)"
                  value={playerOne.stakeAmount}
                  onChange={(e) =>
                    setPlayerOne((prev) => ({
                      ...prev,
                      stakeAmount: e.target.value,
                    }))
                  }
                  className="p-2 border rounded"
                />
                <OptionSelect
                  move={playerOne.move}
                  onChange={(m) => setPlayerOne((v) => ({ ...v, move: m }))}
                />
              </div>

              <input
                type="text"
                placeholder="Enter player 2 address"
                value={playerTwo.address}
                onChange={(e) =>
                  setPlayerTwo((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                className="p-2 border rounded"
              />
              {!contract &&
                (game.signature ? (
                  <div
                    onClick={deploying ? undefined : deployContract}
                    className="cursor-pointer p-2 bg-green-500 text-white rounded"
                  >
                    {deploying ? "Deploying..." : "Start Play"}
                  </div>
                ) : (
                  <div
                    onClick={signMessage}
                    className="cursor-pointer p-2 bg-green-500 text-white rounded"
                  >
                    Sign Message to Play
                  </div>
                ))}
            </div>

            {contract && (
              <>
                <div className="flex flex-col gap-4">
                  <div className="flex">
                    {account === playerOne.address
                      ? "Switch to 2 player"
                      : `Player 2 (${getShortenAddress(
                          playerTwo.address
                        )}) move`}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-black">
                      {`Stake ${playerOne.stakeAmount} ETH to play`}
                    </div>
                    <div className="flex gap-4">
                      <input
                        type="string"
                        placeholder="Enter stake (ETH)"
                        value={playerTwo.stakeAmount}
                        onChange={(e) =>
                          setPlayerTwo((prev) => ({
                            ...prev,
                            stakeAmount: e.target.value,
                          }))
                        }
                        className="p-2 border rounded"
                      />
                      <OptionSelect
                        move={playerTwo.move}
                        onChange={(m) =>
                          setPlayerTwo((v) => ({ ...v, move: m }))
                        }
                      />
                    </div>
                  </div>

                  <div
                    onClick={play}
                    className={`cursor-pointer p-2 bg-yellow-500 text-white rounded ${
                      playerTwo.move === MoveOption.Null ||
                      playerOne.stakeAmount !== playerTwo.stakeAmount
                        ? "pointer-events-none opacity-50"
                        : ""
                    }`}
                  >
                    Play
                  </div>
                </div>
                {gamePlayed && (
                  <div className="flex gap-8">
                    {gameFinished ? (
                      <div
                        onClick={solve}
                        className="flex-auto p-2 bg-purple-500 text-white rounded"
                      >
                        Game completed
                      </div>
                    ) : account === playerOne.address ? (
                      <div
                        onClick={solve}
                        className="cursor-pointer p-2 bg-red-500 text-white rounded"
                      >
                        Resolve game
                      </div>
                    ) : (
                      `Switch to address: ${getShortenAddress(
                        playerOne.address
                      )} to resolve game`
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const OptionSelect = ({
  move,
  onChange,
}: {
  move: MoveOption;
  onChange: (value: MoveOption) => void;
}) => {
  return (
    <select
      value={move}
      onChange={(e) => onChange(Number(e.target.value) as MoveOption)}
      className="p-2 border rounded flex-auto"
    >
      <option value={MoveOption.Null} disabled>
        Select
      </option>
      {getMoveOptions().map(({ label, value }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
};
