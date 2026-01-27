import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { PhaseCard } from './components/PhaseCard.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { StatsBar } from './components/StatsBar.js';
import { ActivityPipeReader, ActivityMessage } from './utils/pipeReader.js';

interface Stage {
	name: string;
	elapsed: string;
	completed: boolean;
}

const App: React.FC = () => {
	const [activities, setActivities] = useState<Array<ActivityMessage & { detail: string }>>([]);
	const [currentStage, setCurrentStage] = useState<{
		stage: string;
		stageDesc: string;
		elapsed: string;
	} | null>(null);
	const [completedStages, setCompletedStages] = useState<Array<{ name: string; elapsed: string }>>([]);
	const [currentPhase, setCurrentPhase] = useState<string>('1');
	const [phaseName, setPhaseName] = useState<string>('Initializing...');
	const [totalPhases] = useState<number>(3);
	const [completedPhases, setCompletedPhases] = useState<number>(0);
	const [startTime] = useState<Date>(new Date());
	const [tokens, setTokens] = useState<number>(0);
	const [cost, setCost] = useState<string>('0.00');
	const [budget] = useState<{ used: number; limit: number } | undefined>(undefined);

	useEffect(() => {
		const pipePath = process.env.GSD_ACTIVITY_PIPE || '.planning/logs/activity.pipe';
		const reader = new ActivityPipeReader(pipePath);

		reader.onMessage((msg) => {
			setActivities((prev) => [...prev, msg]);

			// Handle stage messages
			if (msg.type === 'stage') {
				const [stageType, ...descParts] = msg.detail.split(':');
				const description = descParts.join(':');

				// Add to completed stages
				if (currentStage && currentStage.stage !== stageType) {
					setCompletedStages((prev) => [
						...prev,
						{ name: currentStage.stage, elapsed: currentStage.elapsed },
					]);
				}

				setCurrentStage({
					stage: stageType,
					stageDesc: description,
					elapsed: '0:00',
				});
			}

			// Handle file messages
			if (msg.type === 'file') {
				// Already added to activities
			}

			// Handle commit messages
			if (msg.type === 'commit') {
				// Already added to activities
			}
		});

		reader.start();

		return () => {
			// Cleanup handled by pipe reader
		};
	}, []);

	// Calculate elapsed time
	const elapsedTime = useMemo(() => {
		const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
		const hrs = Math.floor(diff / 3600);
		const mins = Math.floor((diff % 3600) / 60);
		const secs = diff % 60;

		if (hrs > 0) {
			return `${hrs}h ${mins}m ${secs}s`;
		} else if (mins > 0) {
			return `${mins}m ${secs}s`;
		} else {
			return `${secs}s`;
		}
	}, [startTime]);

	// Build stages array
	const stages: Stage[] = useMemo(() => {
		const stages: Stage[] = [
			...completedStages.map((s) => ({ ...s, completed: true })),
		];

		if (currentStage) {
			stages.push({
				name: currentStage.stage,
				elapsed: currentStage.elapsed,
				completed: false,
			});
		}

		return stages;
	}, [completedStages, currentStage]);

	// Calculate progress
	const progress = useMemo(() => {
		if (stages.length === 0) return 0;
		const completed = stages.filter((s) => s.completed).length;
		return (completed / (stages.length + 3)) * 100; // +3 for planned future stages
	}, [stages]);

	return (
		<Box flexDirection="column" padding={1}>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="cyan">
					╔═══╗ ╔╗   ╔╗      ╔══╗
					║╔══╝ ║║   ║║      ║╔╗║
					║╚══╗ ║║   ║║      ║╚╝║
					║╔══╝ ║║   ║║      ║╔╗║
					║╚══╗ ║╚══╗║╚══╗   ║╚╝║
					╚═══╝ ╚═══╝╚═══╝   ╚══╝
				</Text>
			</Box>

			<Text bold color="cyan">
				GET SHIT DONE - AUTOPILOT
			</Text>

			<Box marginY={1}>
				<Text dimColor>
					{'─'.repeat(60)}
				</Text>
			</Box>

			<Box flexDirection="row" gap={1} flexGrow={1}>
				<Box flexDirection="column" flexGrow={1}>
					<PhaseCard
						phase={currentPhase}
						phaseName={phaseName}
						totalPhases={totalPhases}
						currentPhaseIndex={completedPhases}
						stages={stages}
						description={currentStage?.stageDesc}
						progress={progress}
					/>
				</Box>

				<Box flexDirection="column" flexGrow={1}>
					<ActivityFeed activities={activities} />
				</Box>
			</Box>

			<StatsBar
				totalPhases={totalPhases}
				completedPhases={completedPhases}
				elapsedTime={elapsedTime}
				tokens={tokens}
				cost={cost}
				budget={budget}
			/>
		</Box>
	);
};

export default App;