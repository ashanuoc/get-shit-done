import React from 'react';
import { Box, Text } from 'ink';

interface Stage {
	name: string;
	elapsed: string;
	completed: boolean;
}

interface PhaseCardProps {
	phase: string;
	phaseName: string;
	totalPhases: number;
	currentPhaseIndex: number;
	stages: Stage[];
	description?: string;
	progress: number; // 0-100
}

export const PhaseCard: React.FC<PhaseCardProps> = ({
	phase,
	phaseName,
	totalPhases,
	currentPhaseIndex,
	stages,
	description,
	progress,
}) => {
	const getStageColor = (stage: Stage): string => {
		if (stage.completed) return 'green';
		if (stage.name === stages[stages.length - 1]?.name) return 'cyan';
		return 'gray';
	};

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
			<Box justifyContent="space-between" alignItems="center">
				<Text bold color="cyan">
					{`PHASE ${phase}`}
				</Text>
				<Text dimColor>
					{currentPhaseIndex + 1} / {totalPhases}
				</Text>
			</Box>

			<Text bold>{phaseName}</Text>

			{!!description && (
				<Box marginTop={1}>
					<Text dimColor>{description}</Text>
				</Box>
			)}

			<Box marginTop={1} flexDirection="column">
				<Text dimColor>Progress</Text>
				<Box>
					<Box width={40}>
						<Text>
							{Array.from({ length: 40 }, (_, i) => {
								const fillPercent = (i / 40) * 100;
								return (
									<Text key={i} backgroundColor={fillPercent <= progress ? 'cyan' : undefined}>
										{fillPercent <= progress ? '█' : '░'}
									</Text>
								);
							})}
						</Text>
					</Box>
					<Text> {Math.round(progress)}%</Text>
				</Box>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold>Stages</Text>
				{stages.map((stage, idx) => (
					<Box key={idx} justifyContent="space-between">
						<Text color={getStageColor(stage)}>
							{stage.completed ? '✓' : '○'} {stage.name}
						</Text>
						<Text dimColor>{stage.elapsed || 'in progress...'}</Text>
					</Box>
				))}
			</Box>
		</Box>
	);
};