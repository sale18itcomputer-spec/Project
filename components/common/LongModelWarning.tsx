import React from 'react';
import { isModelNameTooLong, MODEL_NAME_MAX_LENGTH } from '../../utils/modelNameGuard';

/**
 * Inline hint under a line item's Model field: shown when Model reads like a pasted spec
 * (over MODEL_NAME_MAX_LENGTH characters) while Description is empty. Warns only — it never
 * blocks saving or edits the line.
 */
const LongModelWarning: React.FC<{
    modelName?: string | null;
    description?: string | null;
    className?: string;
}> = ({ modelName, description, className = 'mt-1 text-[11px]' }) => {
    if (!isModelNameTooLong(modelName, description)) return null;
    const length = (modelName ?? '').trim().length;
    return (
        <p role="status" className={`${className} leading-snug text-amber-700 dark:text-amber-400`}>
            Model is {length} characters (over {MODEL_NAME_MAX_LENGTH}) and Description is empty. Keep the short
            model name here and put the specs in Description, or the PDF prints the whole spec in bold.
        </p>
    );
};

export default LongModelWarning;
