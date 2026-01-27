import React from 'react';
import { Box, Text } from 'ink';

interface StatsBarProps {
	totalPhases: number;
	completedPhases: number;
	elapsedTime: string;
	estimatedTimeRemaining?: string;
	tokens: number;
	cost: string;
	budget?: {
		used: number;
		limit: number;
	};
}

export const StatsBar: React.FC<StatsBarProps> = ({
	totalPhases,
	completedPhases,
	elapsedTime,
	estimatedTimeRemaining,
	tokens,
	cost,
	budget,
}) => {
	const progress = (completedPhases / totalPhases) * 100;

	const formatTime = (seconds: number): string => {
		const hrs = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hrs > 0) {
			return `${hrs}h ${mins}m`;
		} else if (mins > 0) {
			return `${mins}m ${secs}s`;
		} else {
			return `${secs}s`;
		}
	};

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="green"
			padding={1}
			marginTop={1}
		>
			<Box justifyContent="space-between" alignItems="center">
				<Text bold color="green">
					📊 Execution Stats
				</Text>
				<Text dimColor>{elapsedTime}</Text>
			</Box>

			<Box marginTop={1}>
				<Box flexGrow={1} flexDirection="column" marginRight={2}>
					<Text dimColor>Phases</Text>
					<Box alignItems="center">
						<Box width={30}>
							<Text>
								{Array.from({ length: 30 }, (_, i) => {
									const fillPercent = (i / 30) * 100;
									return (
										<Text
											key={i}
											backgroundColor={fillPercent <= progress ? 'green' : undefined}
										>
											{fillPercent <= progress ? '█' : '░'}
										</Text>
									);
								})}
							</Text>
						</Box>
						<Text> {completedPhases}/{totalPhases}</Text>
					</Box>
				</Box>

				<Box flexGrow={1} flexDirection="column" marginLeft={2}>
					<Text dimColor>Time</Text>
					<Text bold color="cyan">
						{elapsedTime}
						{estimatedTimeRemaining && (
							<Text dimColor> (remaining: {estimatedTimeRemaining})</Text>
						)}
					</Text>
				</Box>
			</Box>

			<Box marginTop={1} justifyContent="space-between">
				<Box>
					<Text dimColor>Tokens: </Text>
					<Text bold>{tokens.toLocaleString()}</Text>
				</Box>
				<Box>
					<Text dimColor>Cost: </Text>
					<Text bold color="green">
						${cost}
					</Text>
				</Box>
				{budget && (
					<Box>
						<Text dimColor>Budget: </Text>
						<Text
							bold
							color={
								budget.used / budget.limit > 0.8
									? 'red'
									: budget.used / budget.limit > 0.6
									? 'yellow'
									: 'green'
							}
						>
							${budget.used.toFixed(2)} / ${budget.limit}
						</Text>
					</Box>
				)}
			</Box>

			{budget && (
				<Box marginTop={1}>
					<Text dimColor>Budget Usage: </Text>
					<Box width={40}>
						<Text>
							{Array.from({ length: 40 }, (_, i) => {
								const fillPercent = (i / 40) * (budget.used / budget.limit) * 100;
								const color =
									budget.used / budget.limit > 0.8
										? 'red'
										: budget.used / budget.limit > 0.6
										? 'yellow'
										: 'green';
								return (
									<Text key={i} backgroundColor={color}>
										{fillPercent <= 100 ? '█' : '░'}
									</Text>
								);
							})}
						</Text>
					</Box>
					<Text> {Math.round((budget.used / budget.limit) * 100)}%</Text>
				</Box>
			)}
		</Box>
	);
};