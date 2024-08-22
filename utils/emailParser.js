const parseEmailContent = (text) => {
    const idMatch = text.match(/id\s*:\s*(\d+)/);
    const commentMatch = text.match(/Комментарий\s*:\s*(.*?)(?:\n|$)/);
    const approvedMatch = text.match(/approved\s*:\s*(true|false)/);

    return {
        id: idMatch ? idMatch[1] : null,
        comment: commentMatch ? commentMatch[1].trim() : '',
        approved: approvedMatch ? approvedMatch[1] === 'true' : false,
    };
};

module.exports = {
    parseEmailContent,
};
