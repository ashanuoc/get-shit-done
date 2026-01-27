import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

interface Activity {
	type: 'read' | 'write' | 'edit' | 'commit' | 'test' | 'stage' | 'error' | 'info';
	detail: string;
	timestamp: Date;
}

interface ActivityFeedProps {
	activities: Activity[];
	maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, maxItems = 12 }) => {
	const [dots, setDots] = useState('');

	useEffect(() => {
		const timer = setInterval(() => {
			setDots((prev) => {
				if (prev.length >= 3) return '';
				return prev + '.';
			});
		}, 500);

		return () => clearInterval(timer);
	}, []);

	const displayActivities = activities.slice(-maxItems);

	const getActivityIcon = (type: Activity['type']) => {
		switch (type) {
			case 'read':
				return '📖';
			case 'write':
				return '✍️';
			case 'edit':
				return '📝';
			case 'commit':
				return '✓';
			case 'test':
				return '🧪';
			case 'stage':
				return '⚙️';
			case 'error':
				return '⛔';
			case 'info':
				return 'ℹ️';
			default:
				return '•';
		}
	};

	const getActivityColor = (type: Activity['type']): string => {
		switch (type) {
			case 'read':
				return 'blue';
			case 'write':
				return 'green';
			case 'edit':
				return 'yellow';
			case 'commit':
				return 'green';
			case 'test':
				return 'magenta';
			case 'stage':
				return 'cyan';
			case 'error':
				return 'red';
			case 'info':
				return 'gray';
			default:
				return 'white';
		}
	};

	const getTypeLabel = (type: Activity['type']) => {
		const labels = {
			read: 'READ',
			write: 'WRITE',
			edit: 'EDIT',
			commit: 'COMMIT',
			test: 'TEST',
			stage: 'STAGE',
			error: 'ERROR',
			info: 'INFO',
		};
		return labels[type] || 'ACTIVITY';
	};

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} height={18}>
			<Box justifyContent="space-between" alignItems="center">
				<Text bold>Activity Feed</Text>
				<Text color="gray">{dots}</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} overflow="hidden">
				{displayActivities.length === 0 ? (
					<Text dimColor italic>
						Waiting for activity...
					</Text>
				) : (
					displayActivities.map((activity, idx) => (
						<Box
							key={idx}
							justifyContent="space-between"
							alignItems="center"
							marginBottom={idx < displayActivities.length - 1 ? 0 : 0}
						>
							<Box flexGrow={1}>
								<Text>
									<Text dimColor>[{activity.timestamp.toLocaleTimeString()}]</Text>{' '}
									<Text color={getActivityColor(activity.type)}>
										{getActivityIcon(activity.type)}
									</Text>{' '}
									<Text dimColor>{getTypeLabel(activity.type)}:</Text> {activity.detail}
								</Text>
							</Box>
						</Box>
					))
				)}
			</Box>
		</Box>
	);
};