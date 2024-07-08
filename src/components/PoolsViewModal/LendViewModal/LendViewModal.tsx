import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IPoolsViewModalProps } from '../IPoolsViewModal';
import {
  CodeIcon,
  Gift,
  LucideBanknote,
  Percent,
  UserCheck,
} from 'lucide-react';
import { InterestModal, PoolState } from '@/components/MyPoolsTable/columns';
import { CopyBlock } from 'react-code-blocks';
import Alert from '@/components/Alert/Alert';
import Image from 'next/image';
import { formatEther, parseEther } from 'viem';
import { useCalculateRewardApy, useCheckCoinAllowance } from '@/lens/lens';
import { useWriteContract } from 'wagmi';
import { TuliaPoolABI } from '@/lens/abi/TuliaPool';
import { RewardManagerABI } from '@/lens/abi/RewardManager';
import { VaultManagerABI } from '@/lens/abi/VaultManager';
import { TokenABI } from '@/lens/abi/Token';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { useCalculateClaimableInterest } from '@/lens/lens';
import { useReadContract } from 'wagmi';
import { useGetLoanState, useGetRemainingRepaymentPeriod } from '@/lens/lens';

const LendViewModal = ({ row }: IPoolsViewModalProps) => {
  const account = useAccount();
  const currentLoanState = useGetLoanState(row.original.pool);
  const [isLender, setIsLender] = useState(false);
  const [isFunded, setIsFunded] = useState(false);
  const [uiCollateral, setUiCollateral] = useState<number>(0);
  const {
    writeContract,
    data: hash,
    error: contractError,
  } = useWriteContract();

  const calculateRewardAPY = useCalculateRewardApy({
    loanAmount: BigInt(row.original.amount),
    durationSeconds: Number(currentLoanState),
  });

  const [apy, setApy] = useState<number>(0);
  const [allowance, setAllowance] = useState<number>(0);
  const [approvalNeeded, setApprovalNeeded] = useState<boolean>(false);
  const [activateLoanCheck, setActivateLoanCheck] = useState('');
  const [claimableInterest, setClaimableInterest] = useState<number>(0);
  const [currentVaultManagerReward, setCurrentVaultManagerReward] =
    useState<number>(0);
  const [formattedRepaymentTime, setFormattedRepaymentTime] =
    useState<string>('');
  const [uiLoanState, setUiLoanState] = useState<string>('');

  const [newLoanState, setNewLoanState] = useState<number>(0);
  const {
    writeContract: approve,
    isSuccess: approveSuccess,
    error: approveError,
    status: approveStatus,
  } = useWriteContract();
  const checkAllowance = useCheckCoinAllowance(
    row.original.Token as any,
    row.original.pool as any
  );
  const { data: vaultManagerReward } = useReadContract({
    abi: VaultManagerABI,
    address: '0x8D3520C41d6eca54ab638d85F22a414fB2264114',
    functionName: 'calculateClaimableInterest',
    args: [row.original.pool],
  });

  useEffect(() => {
    if (newLoanState === 2) {
      setUiLoanState('Borrower Found');
    }
    if (newLoanState === 1) {
      setUiLoanState('Waiting for Borrower');
    }
  }, [newLoanState]);

  const latestRepayment = useGetRemainingRepaymentPeriod(row.original.pool);

  useEffect(() => {
    setNewLoanState(currentLoanState as number);
  }, [currentLoanState]);

  const {
    writeContract: activateLoan,
    data: activateLoanHash,
    status: activeLoanStatus,
    error: activeLoanError,
  } = useWriteContract();

  useEffect(() => {
    if (activeLoanStatus === 'success') {
      setActivateLoanCheck('success');
    }
    if (activeLoanStatus === 'error') {
      setActivateLoanCheck('error');
    }
    if (activeLoanStatus === 'pending') {
      setActivateLoanCheck('pending');
    }
  }, [activeLoanStatus]);

  useEffect(() => {
    if (activateLoanCheck === 'success') {
      toast.success('Loan activated successfully');
    }
    if (activateLoanCheck === 'error') {
      toast.error('Error activating loan');
    }
    if (activateLoanCheck === 'pending') {
      toast.info('Loan activation pending');
    }
  }, [activateLoanCheck]);

  useEffect(() => {
    if (calculateRewardAPY) {
      setApy(Number(calculateRewardAPY));
    }
  }, [calculateRewardAPY]);

  useEffect(() => {
    if (vaultManagerReward) {
      setCurrentVaultManagerReward(Number(vaultManagerReward));
    }
  }, [vaultManagerReward]);

  const calculateCollateral = (
    loanAmount: number,
    interestRate: number
  ): number => {
    const principal = parseFloat(loanAmount.toString());
    const rate = parseFloat(interestRate.toString());
    const interest = (principal * rate) / 100;
    const total = principal + interest;
    const netTotal = formatEther(BigInt(total));
    setUiCollateral(Number(netTotal));
    return total;
  };

  useEffect(() => {
    calculateCollateral(row.original.amount, Number(row.original.interestRate));
  }, [row.original.amount, row.original.interestRate]);

  // Function to format the remaining time in seconds to a human-readable format
  const formatDuration = (seconds: number): string => {
    const days: number = Math.floor(seconds / (3600 * 24) / 86400);
    const hours: number = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes: number = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m `;
  };

  useEffect(() => {
    if (latestRepayment !== undefined) {
      const formatted = formatDuration(Number(latestRepayment));
      setFormattedRepaymentTime(formatted);
    }
  }, [latestRepayment]);

  useEffect(() => {
    if (row.original.loan_state === 'Funded') {
      setIsFunded(true);
    } else if (row.original.loan_state === 'Pending') {
      setIsFunded(false);
    }
  }, [row.original.loan_state]);

  useEffect(() => {
    if (String(account?.address) === String(row.original.wallet_address)) {
      setIsLender(true);
    } else {
      setIsLender(false);
    }
  }, [account?.status, account?.address, row.original.wallet_address]);

  useEffect(() => {
    const fetchAllowance = async () => {
      const currentAllowance = checkAllowance;
      if (currentAllowance) {
        setAllowance(Number(currentAllowance));
        setApprovalNeeded(
          Number(currentAllowance) < Number(row.original.amount)
        );
      }
    };
    fetchAllowance();
  }, [checkAllowance, row.original.amount]);

  useEffect(() => {
    if (approveSuccess) {
      toast.success('Approve transaction successful');
      setApprovalNeeded(false);
    }
  }, [approveSuccess]);

  const currentClaimableInterest = useCalculateClaimableInterest({
    pool: row.original.pool,
    isLender: true,
  });

  useEffect(() => {
    if (currentClaimableInterest?.interest !== undefined) {
      setClaimableInterest(currentClaimableInterest.interest);
    }
  }, [currentClaimableInterest]);

  const activatePendingLoan = () => {
    activateLoan({
      abi: TuliaPoolABI,
      address: row.original.pool as any,
      functionName: 'fundLoan',
    });
  };

  const handleApprove = () => {
    approve({
      address: row.original.loanCurrencyAddress as any,
      abi: TokenABI,
      functionName: 'approve',
      args: [row.original.pool as any, parseEther(String(1000000000), 'wei')],
    });
  };

  useEffect(() => {
    if (allowance < row.original.amount) {
      setApprovalNeeded(true);
    } else if (allowance >= row.original.amount) {
      setApprovalNeeded(false);
    }
  }, [allowance, row.original.amount]);

  const formattedInterest = formatEther(BigInt(currentVaultManagerReward));

  return (
    <Dialog>
      {newLoanState === 0 ? (
        approvalNeeded ? (
          <Button
            onClick={handleApprove}
            className="capitalize border-tulia_primary bg-tulia_primary/50 hover:bg-tulia_primary/30"
            disabled={approveStatus === 'pending'}
          >
            Approve Transaction
          </Button>
        ) : (
          <Button
            onClick={activatePendingLoan}
            className="capitalize border-tulia_primary bg-tulia_primary/50 hover:bg-tulia_primary/30"
          >
            Activate Loan
          </Button>
        )
      ) : (
        <DialogTrigger>
          <Button className="capitalize border-tulia_primary bg-tulia_primary/50 hover:bg-tulia_primary/30">
            Manage
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Your Lending Pool</DialogTitle>
          <DialogDescription>
            Here you can see your lending details
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 border-gray-500 pb-2 border-b-[0.5px]">
            <span className="font-bold">
              <UserCheck size={20} className="inline-block mr-2" />
              Lender&apos;s Information
            </span>
          </div>
          <div className="col-span-6 flex flex-col">
            <span className="text-sm font-semibold">Wallet Address</span>
            <span className="text-sm text-gray-400">
              {row.original.wallet_address}
            </span>
          </div>
          <div className="col-span-6 flex flex-col">
            <span className="text-sm font-semibold">Loan Amount</span>
            <span className="text-sm text-gray-400">
              {formatEther(BigInt(row.original.amount))} {row.original.Token}
            </span>
          </div>
          <div className="col-span-12 border-gray-500 pb-2 border-b-[0.5px]">
            <span className="font-bold">
              <UserCheck size={20} className="inline-block mr-2" />
              Borrower&apos;s Information
            </span>
          </div>
          <div className="col-span-4 flex flex-col">
            <span className="text-sm font-semibold">Wallet Address</span>
            <span className="text-sm text-gray-400">
              {row.original.borrower.slice(0, 7)}
            </span>
          </div>
          <div className="col-span-4 flex flex-col">
            <span className="text-sm font-semibold">Loan Status</span>
            <span className="text-sm text-gray-400">{uiLoanState}</span>
          </div>
          <div className="col-span-4 flex flex-col">
            <span className="text-sm font-semibold">Remaining Time</span>
            <span className="text-sm text-gray-400">
              {formattedRepaymentTime}
            </span>
          </div>
          <div className="col-span-12 flex flex-col border-gray-500 pb-2 border-b-[0.5px]">
            {/* Interest Details */}
            <span className="font-bold">
              <Percent size={20} className="inline-block mr-2" />
              Interest Details
            </span>
          </div>
          <div className="col-span-3 flex flex-col">
            <span className="text-sm font-semibold">Interest Rate</span>
            <span className="text-sm text-gray-400">
              {Number(row.original.interestRate)}%
            </span>
          </div>
          <div className="col-span-3 flex flex-col">
            <span className="text-sm font-semibold ">Claimable Interest</span>
            <span className="text-sm text-purple-400">
              {formattedInterest.slice(0, 8)} {row.original.borrowTokenName}{' '}
            </span>
          </div>
          <div className="col-span-3 flex flex-col">
            <span className="text-sm font-semibold">Interest Modal</span>
            <span className="text-sm text-gray-400">
              {row.original.interest_modal}
            </span>
          </div>
          <div className="col-span-3 flex flex-col">
            <span className="text-sm font-semibold">Claimable Rewards </span>
            <span className="text-sm text-green-500 ">
              {Number(claimableInterest) / 10000000}{' '}
              {row.original.borrowTokenName}
            </span>{' '}
            <span className="flex px-1 items-center min-w-16 w-16 border text-xs text-purple-500 border-white/[0.2] bg-transparent  rounded-sm">
              <Image
                src="/logo.png"
                alt="Logo"
                width={20}
                height={20}
                className="flex"
              />
              {apy / 10000}%
            </span>
          </div>
          {/* Loan Details */}
          <div className="col-span-12 flex flex-col border-gray-500 pb-2 border-b-[0.5px]">
            <span className="font-bold">
              <LucideBanknote size={20} className="inline-block mr-2" />
              Loan Details
            </span>
          </div>
          <div className="col-span-4 flex flex-col">
            <span className="text-sm font-semibold">Collateral Amount</span>
            <span className="text-sm text-gray-400">
              {uiCollateral} {row.original.borrowTokenName}
            </span>
          </div>
          <div className="col-span-4 flex flex-col">
            <span className="text-sm font-semibold">Repayment Period</span>
            <span className="text-sm text-gray-400">
              {Number(row.original.repaymentPeriod) / 86400} Days
            </span>
          </div>
          <div className="col-span-12 flex gap-2 flex-col">
            {row.original.interest_modal === InterestModal.FlashLoan && (
              <div className=" flex flex-col items-center justify-center md:col-span-4 col-span-12 md:pt-0 pt-4 md:border-t-0 border-t border-tulia_primary w-full">
                <div className="w-full">
                  <span>
                    <Button
                      type="button"
                      className="capitalize bg-tulia_primary/50 w-full mt-2"
                    >
                      Claim Interest.
                    </Button>
                  </span>
                </div>
                <Dialog>
                  <DialogTrigger type="button" className="w-full">
                    <Button
                      type="button"
                      className="bg-tulia_primary/50 w-full mt-2"
                    >
                      <CodeIcon className="w-4 h-4 inline-block mr-2" />
                      View Flash Loan Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[520px] overflow-y-auto">
                    <DialogTitle>Flash Loan Contract</DialogTitle>
                    <DialogDescription>
                      This is the flash loan contract that you can use to
                      initiate a flash loan request.
                    </DialogDescription>
                    <CopyBlock
                      language="solidity"
                      wrapLongLines
                      showLineNumbers
                      text={`
              // SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";

contract MockFlashBorrower is IERC3156FlashBorrower {
using SafeERC20 for IERC20;

IERC3156FlashLender public lender;
address public admin;

constructor(address _lender) {
    lender = IERC3156FlashLender(_lender);
    admin = msg.sender;
}

// This function initiates a flash loan request
function requestFlashLoan(address token, uint256 amount, bytes calldata data) external {
    require(msg.sender == admin, "Only admin can initiate flash loan");
    lender.flashLoan(this, token, amount, data);
}

// This is the callback function that the lender will call
function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 fee,
    bytes calldata data
) external override returns (bytes32) {
    require(msg.sender == address(lender), "Only lender can call this function");
    require(initiator == address(this), "Unrecognized initiator");

    // Placeholder for custom logic to utilize the flash loaned amount
    // Example: arbitrage, collateral swap, etc.
    // data can be used to pass custom parameters needed for the operation

    // Repay the flash loan
    uint256 totalRepayment = amount + fee;
    IERC20(token).safeTransfer(msg.sender, totalRepayment);

    return keccak256("ERC3156FlashBorrower.onFlashLoan");
}

function setLender(address _lender) external {
    require(msg.sender == admin, "Only admin can set lender");
    lender = IERC3156FlashLender(_lender);
}
}
`}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <div className="col-span-12 flex flex-row border-gray-500 pb-2 border-b-[0.5px] gap-4">
              <Alert
                actionButton={
                  <Button className="capitalize border-tulia_primary bg-primary/50 hover:bg-primary/20 w-[100%]">
                    Claim Interest <Gift size={16} className="ml-2" />
                  </Button>
                }
                actionText="Claim Interest"
                description="Are you sure you want to claim the rewards?"
                title="Claim Rewards"
                actionFunction={() => {
                  if (newLoanState <= 1) {
                    toast.error('Waiting for borrower to give interest');
                  } else
                    writeContract({
                      abi: VaultManagerABI,
                      address: '0x8D3520C41d6eca54ab638d85F22a414fB2264114',
                      functionName: 'distributeInterest',
                      args: [row.original.pool, account?.address],
                    });
                  toast.info(
                    `Claiming ${formatEther(BigInt(currentVaultManagerReward))} ${row.original.borrowTokenName}`
                  );
                }}
                actionButtonStyle="!bg-primary/50 hover:!bg-primary/20 !w-full"
                triggerClassName="w-full"
                cancelText="Cancel"
              />
              <Alert
                actionButton={
                  <Button className="capitalize border-tulia_primary bg-primary/50 hover:bg-primary/20 w-[100%]">
                    Claim Rewards <Gift size={16} className="ml-2" />
                  </Button>
                }
                actionText="Claim Rewards"
                description="Are you sure you want to claim the rewards?"
                title="Claim Rewards"
                actionFunction={() => {
                  writeContract({
                    abi: RewardManagerABI,
                    address: '0xa5Fe443f5D1e2Af4D62583308Dc428494C19C915',
                    functionName: 'claimRewards',
                    args: [row.original.pool, true],
                  });
                  toast.info(
                    `Claiming ${Number(claimableInterest) / 10000000} ${row.original.borrowTokenName}`
                  );
                  console.log('claim rewards');
                }}
                actionButtonStyle="!bg-primary/50 hover:!bg-primary/20 !w-full"
                triggerClassName="w-full"
                cancelText="Cancel"
              />
            </div>
            <Alert
              actionButton={
                <Button className="capitalize border-tulia_primary bg-green-900 hover:bg-green-950 w-full">
                  Default Loan
                </Button>
              }
              actionText="Default The Loan"
              description="Are you sure you want to default the loan? Collateral amount and remaining interest will return to you."
              title="Default Loan Deal"
              actionFunction={() => {
                if (latestRepayment !== 0) {
                  toast.error(
                    `There is still ${formattedRepaymentTime} remaining before you can default the loan.`
                  );
                } else {
                  writeContract({
                    abi: TuliaPoolABI,
                    address: row.original.pool as any,
                    functionName: 'checkAndHandleDefault',
                  });
                }
              }}
              actionButtonStyle="!bg-green-900 hover:bg-green-950"
              cancelText="Cancel"
            />
            <Alert
              actionButton={
                <Button className="capitalize border-tulia_primary bg-red-900 hover:bg-red-950 w-full">
                  Close Deal
                </Button>
              }
              actionText="Close Deal"
              description="Are you sure you want to reclaim the loan deal? Funded amount will be returned to the lender and the pool will be closed."
              title="Close Loan Deal"
              actionFunction={() => {
                if (Number(newLoanState) > 1) {
                  toast.error('Loan is not in a state to be closed.');
                } else {
                  writeContract({
                    abi: TuliaPoolABI,
                    address: row.original.pool as any,
                    functionName: 'reclaimLoanAndClosePool',
                  });
                }
              }}
              actionButtonStyle="!bg-red-900 hover:!bg-red-950"
              cancelText="Cancel"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LendViewModal;
